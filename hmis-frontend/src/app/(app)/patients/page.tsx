'use client';

import { Suspense, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { PatientStats, PatientTable } from '@/components/patients';
import { PatientFiltersClient } from '@/components/patients/PatientFiltersClient';
import { CreatePatientButton } from '@/components/patients/CreatePatientButton';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Patients Page - Client Component
 *
 * Interactive patient management with URL state:
 * - URL state management for bookmarkable filters
 * - Client-side data fetching with React Query (when available)
 *
 * Search params:
 * - page: number (default: 1)
 * - search: string (patient name or MRN)
 * - gender: "M" | "F" | ""
 */

export default function PatientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const genderFilter = searchParams.get('gender') || '';
  const pageSize = 10;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
        const queryParams = new URLSearchParams({
          page: page.toString(),
          page_size: pageSize.toString(),
        });

        if (search) queryParams.append('query', search);
        if (genderFilter) queryParams.append('gender', genderFilter);

        const response = await fetch(`${apiUrl}/patients/search?${queryParams.toString()}`, {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch patients: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [page, search, genderFilter, pageSize]);

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

      {/* Table - Client-side pagination */}
      <Card>
        <PatientTable
          patients={data?.items || []}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={data?.total || 0}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
