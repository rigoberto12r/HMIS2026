'use client';

import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { PatientStats, PatientTable } from '@/components/patients';
import { PatientFiltersClient } from '@/components/patients/PatientFiltersClient';
import { CreatePatientButton } from '@/components/patients/CreatePatientButton';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePatients } from '@/hooks/usePatients';

/**
 * Patients Page - Client Component
 *
 * Interactive patient management with URL state:
 * - URL state management for bookmarkable filters
 * - React Query for data fetching with automatic caching
 *
 * Search params:
 * - page: number (default: 1)
 * - search: string (patient name or MRN)
 * - gender: "M" | "F" | ""
 */

function PatientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const genderFilter = searchParams.get('gender') || '';
  const pageSize = 10;

  // Use React Query hook with authenticated API client
  const { data, isLoading, error } = usePatients({
    page,
    page_size: pageSize,
    query: search || undefined,
    gender: genderFilter || undefined,
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/patients?${params.toString()}`);
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
        <CreatePatientButton />
      </div>

      {/* Stats */}
      <Suspense fallback={<Card className="h-32 animate-pulse bg-neutral-100" />}>
        <PatientStats />
      </Suspense>

      {/* Filters - Client Component for interactivity */}
      <Card className="p-4">
        <PatientFiltersClient
          initialSearch={search}
          initialGender={genderFilter}
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

      {/* Table - Client-side pagination with React Query */}
      <Card>
        <PatientTable
          patients={data?.items || []}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={data?.total || 0}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <PatientsContent />
    </Suspense>
  );
}
