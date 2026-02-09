'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import {
  PatientFilters,
  PatientStats,
  PatientTable,
  CreatePatientModal,
} from '@/components/patients';

export default function PatientsPage() {
  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const pageSize = 10;

  // Fetch patients with React Query
  const { data, isLoading, error } = usePatients({
    page,
    page_size: pageSize,
    query: search || undefined,
    gender: genderFilter || undefined,
  });

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleGenderChange = (value: string) => {
    setGenderFilter(value);
    setPage(1);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Función de exportación en desarrollo');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Pacientes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestiona el registro de pacientes del sistema
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setShowNewModal(true)}
          className="w-full sm:w-auto"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Nuevo Paciente
        </Button>
      </div>

      {/* Stats */}
      <PatientStats />

      {/* Filters */}
      <Card className="p-4">
        <PatientFilters
          search={search}
          genderFilter={genderFilter}
          onSearchChange={handleSearchChange}
          onGenderChange={handleGenderChange}
          onExport={handleExport}
        />
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al cargar pacientes</p>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <PatientTable
          patients={data?.items || []}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={data?.total || 0}
          onPageChange={setPage}
        />
      </Card>

      {/* Create Patient Modal */}
      <CreatePatientModal open={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  );
}
