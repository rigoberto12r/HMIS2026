'use client';

import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download } from 'lucide-react';

interface PatientFiltersProps {
  search: string;
  genderFilter: string;
  onSearchChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onExport?: () => void;
}

const genderOptions = [
  { value: '', label: 'Todos los géneros' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

export function PatientFilters({
  search,
  genderFilter,
  onSearchChange,
  onGenderChange,
  onExport,
}: PatientFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Buscar por nombre, MRN o documento..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Gender Filter */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <Filter className="w-4 h-4 text-neutral-400" />
        <Select
          value={genderFilter}
          onChange={(e) => onGenderChange(e.target.value)}
          options={genderOptions}
          className="flex-1"
        />
      </div>

      {/* Export Button */}
      {onExport && (
        <Button variant="outline" size="md" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      )}
    </div>
  );
}
