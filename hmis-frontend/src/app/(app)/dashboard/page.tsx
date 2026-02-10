/**
 * Dashboard Page - Refactored
 * Reduced from 610 lines using React Query and modular components
 */

'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  useDashboardPatients,
  useDashboardAppointments,
  useDashboardInvoices,
  useARAgingReport,
} from '@/hooks/useDashboard';
import { DashboardKPIs } from './components/DashboardKPIs';
import { WeeklyPatientsChart } from './components/WeeklyPatientsChart';
import { ARAgingChart } from './components/ARAgingChart';
import { AppointmentsPieChart } from './components/AppointmentsPieChart';
import { RecentActivity } from './components/RecentActivity';
import { GeneralSummary } from './components/GeneralSummary';

export default function DashboardPage() {
  // Fetch all dashboard data in parallel with React Query
  const { data: patientsData, isLoading: loadingPatients } = useDashboardPatients();
  const { data: appointmentsData, isLoading: loadingAppointments } = useDashboardAppointments();
  const { data: invoicesData, isLoading: loadingInvoices } = useDashboardInvoices();
  const { data: arReport, isLoading: loadingAR } = useARAgingReport();

  // Extract data from responses
  const patients = patientsData?.items ?? [];
  const totalPatients = patientsData?.total ?? 0;
  const appointments = appointmentsData?.items ?? [];
  const totalAppointments = appointmentsData?.total ?? 0;
  const invoices = invoicesData?.items ?? [];
  const totalInvoices = invoicesData?.total ?? 0;

  // Calculate derived values
  const ingresosMes = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const cuentasPorCobrar = arReport?.total_receivable ?? 0;

  // Check if all queries are loading
  const loading = loadingPatients || loadingAppointments || loadingInvoices || loadingAR;

  // ─── Loading State ──────────────────────────────────────

  if (loading && !patientsData && !appointmentsData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Panel Principal</h1>
          <p className="page-subtitle">Vista general del sistema hospitalario</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-neutral-500">Cargando datos del panel...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────

  if (
    !loading &&
    !patientsData &&
    !appointmentsData &&
    !invoicesData &&
    !arReport
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Panel Principal</h1>
          <p className="page-subtitle">Vista general del sistema hospitalario</p>
        </div>
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-neutral-700 font-medium">
              No se pudo conectar con el servidor. Verifique su conexion.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Panel Principal</h1>
        <p className="page-subtitle">Vista general del sistema hospitalario</p>
      </div>

      {/* KPI Cards */}
      <DashboardKPIs
        patients={patients}
        totalPatients={totalPatients}
        appointments={appointments}
        totalAppointments={totalAppointments}
        invoices={invoices}
        totalInvoices={totalInvoices}
        arReport={arReport ?? null}
        loading={loading}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        <WeeklyPatientsChart totalPatients={totalPatients} />
        <ARAgingChart arReport={arReport ?? null} invoices={invoices} ingresosMes={ingresosMes} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AppointmentsPieChart appointments={appointments} />
        <RecentActivity appointments={appointments} />
        <GeneralSummary
          totalPatients={totalPatients}
          totalAppointments={totalAppointments}
          totalInvoices={totalInvoices}
          ingresosMes={ingresosMes}
          cuentasPorCobrar={cuentasPorCobrar}
          arReport={arReport ?? null}
        />
      </div>
    </div>
  );
}
