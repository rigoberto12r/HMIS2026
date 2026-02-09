'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

/**
 * Appointment Filters - Client Component
 *
 * Manages URL state for appointment filters:
 * - Updates URL search params on filter changes
 * - Enables bookmarkable filter states
 * - Uses useTransition for smooth navigation
 */

interface AppointmentFiltersClientProps {
  initialDateFrom: string;
  initialDateTo: string;
  initialStatus: string;
}

export function AppointmentFiltersClient({
  initialDateFrom,
  initialDateTo,
  initialStatus,
}: AppointmentFiltersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for controlled inputs
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [status, setStatus] = useState(initialStatus);

  /**
   * Update URL search params while preserving other params
   */
  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    params.set('page', '1');

    // Use startTransition for smooth navigation
    startTransition(() => {
      router.push(`/appointments?${params.toString()}`);
    });
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    updateFilters('date_from', value);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    updateFilters('date_to', value);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateFilters('status', value);
  };

  const statusOptions = [
    { value: '', label: 'Todos los Estados' },
    { value: 'scheduled', label: 'Programada' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'checked_in', label: 'En Espera' },
    { value: 'in_progress', label: 'En Consulta' },
    { value: 'completed', label: 'Completada' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'no_show', label: 'No Asistió' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      <Filter className="w-4 h-4 text-neutral-400 mt-2.5 hidden lg:block" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
        <Input
          type="date"
          label="Desde"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          disabled={isPending}
        />
        <Input
          type="date"
          label="Hasta"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          disabled={isPending}
        />
        <Select
          label="Estado"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={statusOptions}
          disabled={isPending}
        />
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="absolute top-2 right-2">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
