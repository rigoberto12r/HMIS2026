'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MotionStagger, MotionStaggerItem } from '@/components/ui/motion';
import {
  useDashboardPatients,
  useDashboardAppointments,
  useDashboardInvoices,
  useARAgingReport,
} from '@/hooks/useDashboard';
import { DashboardKPIs } from './components/DashboardKPIs';
import { DashboardGreeting } from './components/DashboardGreeting';
import { DailyProgress } from './components/DailyProgress';
import { ActivityFeed } from './components/ActivityFeed';
import { WeeklyPatientsChart } from './components/WeeklyPatientsChart';
import { ARAgingChart } from './components/ARAgingChart';
import { AppointmentsPieChart } from './components/AppointmentsPieChart';
import { RecentActivity } from './components/RecentActivity';
import { GeneralSummary } from './components/GeneralSummary';

export default function DashboardPage() {
  const { data: patientsData, isLoading: loadingPatients } = useDashboardPatients();
  const { data: appointmentsData, isLoading: loadingAppointments } = useDashboardAppointments();
  const { data: invoicesData, isLoading: loadingInvoices } = useDashboardInvoices();
  const { data: arReport, isLoading: loadingAR } = useARAgingReport();

  const patients = patientsData?.items ?? [];
  const totalPatients = patientsData?.total ?? 0;
  const appointments = appointmentsData?.items ?? [];
  const totalAppointments = appointmentsData?.total ?? 0;
  const invoices = invoicesData?.items ?? [];
  const totalInvoices = invoicesData?.total ?? 0;

  const ingresosMes = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const cuentasPorCobrar = arReport?.total_receivable ?? 0;

  const loading = loadingPatients || loadingAppointments || loadingInvoices || loadingAR;

  // Calculate daily progress
  const completedToday = appointments.filter(
    (a) => a.status === 'completada' || a.status === 'completed'
  ).length;
  const totalToday = appointments.length || 12;

  if (loading && !patientsData && !appointmentsData) {
    return (
      <div className="space-y-6">
        <DashboardGreeting />
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center animate-pulse">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <p className="text-sm text-surface-500">Cargando datos del panel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !patientsData && !appointmentsData && !invoicesData && !arReport) {
    return (
      <div className="space-y-6">
        <DashboardGreeting />
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-surface-700 dark:text-surface-300 font-medium">
              No se pudo conectar con el servidor. Verifique su conexion.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <MotionStagger className="space-y-6">
      {/* Header */}
      <MotionStaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <DashboardGreeting />
          <div className="w-full sm:w-80">
            <DailyProgress completed={completedToday} total={totalToday} />
          </div>
        </div>
      </MotionStaggerItem>

      {/* KPI Cards */}
      <MotionStaggerItem>
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
      </MotionStaggerItem>

      {/* Charts Row */}
      <MotionStaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          <WeeklyPatientsChart totalPatients={totalPatients} />
          <ARAgingChart arReport={arReport ?? null} invoices={invoices} ingresosMes={ingresosMes} />
        </div>
      </MotionStaggerItem>

      {/* Bottom Row */}
      <MotionStaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AppointmentsPieChart appointments={appointments} />
          <Card>
            <ActivityFeed />
          </Card>
          <GeneralSummary
            totalPatients={totalPatients}
            totalAppointments={totalAppointments}
            totalInvoices={totalInvoices}
            ingresosMes={ingresosMes}
            cuentasPorCobrar={cuentasPorCobrar}
            arReport={arReport ?? null}
          />
        </div>
      </MotionStaggerItem>
    </MotionStagger>
  );
}
