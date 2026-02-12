/**
 * DashboardKPIs Component
 * Displays 4 KPI cards for dashboard overview
 */

import { Users, CalendarCheck, Receipt, DollarSign } from 'lucide-react';
import { KpiCard } from '@/components/ui/card';
import { formatRD, isToday } from '../utils';
import type { Patient, Appointment, ARAgingReport } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';

interface Props {
  patients: Patient[];
  totalPatients: number;
  appointments: Appointment[];
  totalAppointments: number;
  invoices: Invoice[];
  totalInvoices: number;
  arReport: ARAgingReport | null;
  loading?: boolean;
}

export function DashboardKPIs({
  patients,
  totalPatients,
  appointments,
  totalAppointments,
  invoices,
  totalInvoices,
  arReport,
  loading,
}: Props) {
  // Calculate KPIs
  const todayAppointments = appointments.filter(
    (apt) => isToday(apt.scheduled_date) || isToday(apt.created_at)
  );
  const citasHoy = todayAppointments.length > 0 ? todayAppointments.length : totalAppointments;

  const ingresosMes = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const cuentasPorCobrar = arReport?.total_receivable ?? 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-surface-100 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Pacientes Registrados"
        value={totalPatients}
        change={`${patients.length} recientes`}
        changeType="neutral"
        icon={Users}
        iconColor="bg-primary-50 text-primary-500"
      />
      <KpiCard
        title="Citas Hoy"
        value={citasHoy}
        change={`${totalAppointments} en total`}
        changeType="neutral"
        icon={CalendarCheck}
        iconColor="bg-secondary-50 text-secondary-500"
      />
      <KpiCard
        title="Ingresos del Mes"
        value={formatRD(ingresosMes)}
        change={`${totalInvoices} facturas`}
        changeType="positive"
        icon={Receipt}
        iconColor="bg-green-50 text-green-600"
      />
      <KpiCard
        title="Cuentas por Cobrar"
        value={formatRD(cuentasPorCobrar)}
        change={arReport ? `${arReport.items?.length ?? 0} pendientes` : 'Sin datos'}
        changeType={cuentasPorCobrar > 0 ? 'negative' : 'neutral'}
        icon={DollarSign}
        iconColor="bg-orange-50 text-orange-500"
      />
    </div>
  );
}
