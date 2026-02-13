'use client';

import { Suspense, useState } from 'react';
import { Card, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, UserPlus, Activity, LayoutGrid, LayoutList, Download, Filter } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePatients, usePatientStats } from '@/hooks/usePatients';
import { PatientSearchBar } from '@/components/patients/PatientSearchBar';
import { PatientAdvancedFilters } from '@/components/patients/PatientAdvancedFilters';
import { PatientListTable } from '@/components/patients/PatientListTable';
import { PatientCardGrid } from '@/components/patients/PatientCardGrid';
import { PatientDetailDrawer } from '@/components/patients/PatientDetailDrawer';
import { NewPatientFAB } from '@/components/patients/NewPatientFAB';
import { cn } from '@/lib/utils';
import type { Patient } from '@/hooks/usePatients';

/**
 * Patients Page - Modern CRM-Style Interface
 *
 * Features:
 * - Large prominent search bar with debounced instant search
 * - Collapsible advanced filters sidebar
 * - Table and card grid view toggle
 * - Patient detail drawer (360° view)
 * - Floating action button for new patient
 * - Multi-select and bulk actions
 * - Responsive design with dark mode support
 */

type ViewMode = 'table' | 'grid';

function PatientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());

  // URL params
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = 20;

  // Build filter params from URL
  const filterParams: Record<string, any> = {
    page,
    page_size: pageSize,
  };

  const search = searchParams.get('search');
  if (search) filterParams.query = search;

  const gender = searchParams.get('gender');
  if (gender) filterParams.gender = gender;

  const ageMin = searchParams.get('age_min');
  if (ageMin) filterParams.age_min = ageMin;

  const ageMax = searchParams.get('age_max');
  if (ageMax) filterParams.age_max = ageMax;

  const bloodType = searchParams.get('blood_type');
  if (bloodType) filterParams.blood_type = bloodType;

  // Fetch data
  const { data, isLoading, error } = usePatients(filterParams);
  const { data: stats, isLoading: statsLoading } = usePatientStats();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/patients?${params.toString()}`);
  };

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatientId(patient.id);
  };

  const handleBulkExport = () => {
    console.log('Exporting selected patients:', Array.from(selectedPatients));
    // TODO: Implement bulk export
  };

  const handleBulkMessage = () => {
    console.log('Sending message to selected patients:', Array.from(selectedPatients));
    // TODO: Implement bulk messaging
  };

  return (
    <>
      <div className="min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-2">
            Gestión de Pacientes
          </h1>
          <p className="text-sm text-surface-500">
            Vista tipo CRM para gestión eficiente de pacientes
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="Total Pacientes"
            value={stats?.total_patients || 0}
            icon={Users}
            variant="primary"
            loading={statsLoading}
          />
          <KpiCard
            title="Nuevos (este mes)"
            value={stats?.new_this_month || 0}
            icon={UserPlus}
            variant="success"
            change="+12%"
            changeType="positive"
            loading={statsLoading}
          />
          <KpiCard
            title="Activos"
            value={stats?.active_patients || 0}
            icon={Activity}
            variant="primary"
            loading={statsLoading}
          />
          <KpiCard
            title="Con Alertas"
            value={0}
            icon={AlertTriangle}
            variant="warning"
            loading={statsLoading}
          />
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <PatientSearchBar />
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Advanced Filters Sidebar */}
          {filtersOpen && (
            <div className="w-80 flex-shrink-0">
              <PatientAdvancedFilters
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen(!filtersOpen)}
              />
            </div>
          )}

          {/* Filters toggle when closed */}
          {!filtersOpen && (
            <PatientAdvancedFilters
              isOpen={filtersOpen}
              onToggle={() => setFiltersOpen(!filtersOpen)}
            />
          )}

          {/* Patient List */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      viewMode === 'table'
                        ? 'bg-white dark:bg-surface-100 text-primary-600 shadow-sm'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'
                    )}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-surface-100 text-primary-600 shadow-sm'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>

                {/* Filter Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={cn(filtersOpen && 'bg-primary-50 dark:bg-primary-900/30 border-primary-500')}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>

              {/* Bulk Actions */}
              {selectedPatients.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar ({selectedPatients.size})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkMessage}>
                    Enviar Mensaje ({selectedPatients.size})
                  </Button>
                </div>
              )}
            </div>

            {/* Error State */}
            {error && (
              <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-900/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-400">
                      Error al cargar pacientes
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                      {error instanceof Error ? error.message : 'Error desconocido'}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Patient List - Table or Grid */}
            {viewMode === 'table' ? (
              <PatientListTable
                patients={data?.items || []}
                loading={isLoading}
                page={page}
                pageSize={pageSize}
                total={data?.total || 0}
                onPageChange={handlePageChange}
                onPatientClick={handlePatientClick}
                selectedPatients={selectedPatients}
                onSelectionChange={setSelectedPatients}
              />
            ) : (
              <PatientCardGrid
                patients={data?.items || []}
                loading={isLoading}
                page={page}
                pageSize={pageSize}
                total={data?.total || 0}
                onPageChange={handlePageChange}
                onPatientClick={handlePatientClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Patient Detail Drawer */}
      {selectedPatientId && (
        <PatientDetailDrawer
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
        />
      )}

      {/* Floating Action Button */}
      <NewPatientFAB />
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <PatientsContent />
    </Suspense>
  );
}
