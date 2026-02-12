'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Skeleton } from './skeleton';

// ─── Types ──────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ReactNode;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  stickyHeader?: boolean;
}

// ─── Component ──────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron registros.',
  loading = false,
  onRowClick,
  className,
  stickyHeader = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((val) =>
        String(val ?? '').toLowerCase().includes(lowerSearch)
      )
    );
  }, [data, search]);

  const sortedData = useMemo(() => {
    if (!sort.column || !sort.direction) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.column!];
      const bVal = (b as Record<string, unknown>)[sort.column!];
      const comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''), 'es', {
        numeric: true,
      });
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sort]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function handleSort(columnKey: string) {
    setSort((prev) => {
      if (prev.column !== columnKey) return { column: columnKey, direction: 'asc' };
      if (prev.direction === 'asc') return { column: columnKey, direction: 'desc' };
      return { column: null, direction: null };
    });
  }

  function handleSearch(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function getSortIcon(columnKey: string) {
    if (sort.column !== columnKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-surface-300" />;
    if (sort.direction === 'asc') return <ChevronUp className="w-3.5 h-3.5 text-primary-500 transition-transform" />;
    return <ChevronDown className="w-3.5 h-3.5 text-primary-500 transition-transform" />;
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search */}
      {searchable && (
        <div className="relative max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="form-input pl-9"
            aria-label={searchPlaceholder}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700 -webkit-overflow-scrolling-touch">
        <table className="w-full text-sm min-w-[640px]">
          <thead className={cn(
            'bg-surface-50/80 dark:bg-surface-800/80 backdrop-blur-sm',
            stickyHeader && 'sticky top-0 z-10'
          )}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'table-header px-4 py-3 border-b border-surface-200 dark:border-surface-700',
                    alignClasses[col.align || 'left'],
                    col.sortable && 'cursor-pointer select-none hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors'
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sort.column === col.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                    {col.header}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700 bg-white dark:bg-surface-100">
            {loading ? (
              Array.from({ length: pageSize }).map((_, rowIdx) => (
                <tr key={`skel-${rowIdx}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className={cn('h-4', col.align === 'right' ? 'ml-auto w-16' : 'w-3/4')} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="text-sm text-surface-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    'transition-all duration-150 group',
                    onRowClick && 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/10 hover:border-l-2 hover:border-l-primary-500'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-surface-700 dark:text-surface-300',
                        alignClasses[col.align || 'left']
                      )}
                    >
                      {col.render
                        ? col.render(row, (currentPage - 1) * pageSize + index)
                        : String((row as Record<string, unknown>)[col.key] ?? '---')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-surface-500 order-2 sm:order-1">
            Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length} registros
          </p>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  aria-label={`Pagina ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={cn(
                    currentPage === page && 'rounded-full min-w-[32px]'
                  )}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Pagina siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
