'use client';

import { Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AppointmentList } from '@/components/appointments/AppointmentList';
import { AppointmentFiltersClient } from '@/components/appointments/AppointmentFiltersClient';
import { AppointmentHeader } from '@/components/appointments/AppointmentHeader';
import { CalendarView } from '@/components/appointments/CalendarView';
import { useAppointments } from '@/hooks/useAppointments';

/**
 * Appointments Page Content - Client Component with React Query
 *
 * Uses URL search params for bookmarkable filter state
 * and React Query for authenticated data fetching + caching.
 */
function AppointmentsPageContent() {
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const view = (searchParams.get('view') as 'list' | 'calendar') || 'list';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';
  const statusFilter = searchParams.get('status') || '';

  const { data, isLoading, error } = useAppointments({
    page,
    page_size: 20,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header with view toggle and create button */}
      <AppointmentHeader initialView={view} />

      {/* Filters - Client Component for interactivity */}
      <Card className="p-4">
        <AppointmentFiltersClient
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
          initialStatus={statusFilter}
        />
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al cargar citas</p>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <AppointmentList
          appointments={data?.items || []}
          loading={isLoading}
        />
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <Card className="p-4">
          <CalendarView
            appointments={data?.items || []}
            loading={isLoading}
          />
        </Card>
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <AppointmentsPageContent />
    </Suspense>
  );
}
