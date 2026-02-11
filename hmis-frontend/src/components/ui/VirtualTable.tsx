/**
 * VirtualTable Component
 * Virtualized table for rendering large datasets efficiently
 * Uses @tanstack/react-virtual for performance
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export interface VirtualTableColumn<T> {
  key: string;
  header: string;
  width?: string | number;
  render: (item: T) => React.ReactNode;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  estimateSize?: number;
  overscan?: number;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function VirtualTable<T extends { id: string | number }>({
  data,
  columns,
  estimateSize = 60,
  overscan = 5,
  onRowClick,
  className = '',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto border border-neutral-200 rounded-lg ${className}`}
      style={{ height: '600px' }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-neutral-50 border-b border-neutral-200 z-10">
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className="px-4 py-3 text-left text-sm font-semibold text-neutral-700"
              style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual rows */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const item = data[virtualRow.index];
          return (
            <div
              key={item.id}
              className={`absolute top-0 left-0 w-full flex items-center border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="px-4 py-2 text-sm text-neutral-700"
                  style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
                >
                  {column.render(item)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="p-8 text-center text-sm text-neutral-500">
          No hay datos para mostrar
        </div>
      )}
    </div>
  );
}

/**
 * Example usage:
 *
 * <VirtualTable
 *   data={patients}
 *   columns={[
 *     { key: 'mrn', header: 'MRN', width: 120, render: (p) => p.mrn },
 *     { key: 'name', header: 'Nombre', render: (p) => p.full_name },
 *     { key: 'age', header: 'Edad', width: 80, render: (p) => calculateAge(p.birth_date) },
 *   ]}
 *   onRowClick={(patient) => router.push(`/patients/${patient.id}`)}
 * />
 */
