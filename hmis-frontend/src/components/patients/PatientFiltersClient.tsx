'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

/**
 * Patient Filters - Client Component
 *
 * Manages URL state for filters using Next.js App Router:
 * - Updates URL search params on filter changes
 * - Enables bookmarkable filter states
 * - Preserves filters on page refresh
 * - Uses useTransition for smooth navigation
 */

interface PatientFiltersClientProps {
  initialSearch: string;
  initialGender: string;
}

export function PatientFiltersClient({
  initialSearch,
  initialGender,
}: PatientFiltersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for controlled inputs
  const [search, setSearch] = useState(initialSearch);
  const [gender, setGender] = useState(initialGender);

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
      router.push(`/patients?${params.toString()}`);
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    updateFilters('search', value);
  };

  const handleGenderChange = (value: string) => {
    setGender(value);
    updateFilters('gender', value);
  };

  const handleExport = () => {
    toast.info('Función de exportación en desarrollo');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Buscar por nombre, MRN o documento..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Gender Filter */}
      <div className="w-full sm:w-48">
        <Select
          value={gender}
          onChange={(e) => handleGenderChange(e.target.value)}
          disabled={isPending}
        >
          <option value="">Todos los géneros</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
        </Select>
      </div>

      {/* Export Button */}
      <Button
        variant="outline"
        onClick={handleExport}
        className="w-full sm:w-auto"
        disabled={isPending}
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar
      </Button>

      {/* Loading indicator */}
      {isPending && (
        <div className="absolute top-2 right-2">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
