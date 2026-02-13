'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import {
  useDashboardPatients,
  useDashboardAppointments,
  useDashboardInvoices,
  useARAgingReport,
} from '@/hooks/useDashboard';
import { deriveHourlyDistribution } from './utils';
import { HealthOSGreeting } from './components/HealthOSGreeting';
import { HealthOSKPIs } from './components/HealthOSKPIs';
import { ClinicalActivity } from './components/ClinicalActivity';
import { InsightsChart } from './components/InsightsChart';
import { QuickActions } from './components/QuickActions';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { RevenueChart } from './components/RevenueChart';
import { TopDiagnosesChart } from './components/TopDiagnosesChart';
import { AlertsPanel } from './components/AlertsPanel';
import { RecentActivityTimeline } from './components/RecentActivityTimeline';
import { DashboardSkeleton } from './components/DashboardSkeleton';

export default function DashboardPage() {
  const { data: patientsData, isLoading: loadingPatients } = useDashboardPatients();
  const { data: appointmentsData, isLoading: loadingAppointments } = useDashboardAppointments();
  const { data: invoicesData, isLoading: loadingInvoices } = useDashboardInvoices();
  const { data: arReport, isLoading: loadingAR } = useARAgingReport();

  const totalPatients = patientsData?.total ?? 0;
  const appointments = appointmentsData?.items ?? [];
  const invoices = invoicesData?.items ?? [];

  const loading = loadingPatients || loadingAppointments || loadingInvoices || loadingAR;
  const hourlyData = deriveHourlyDistribution(appointments);

  if (loading && !patientsData && !appointmentsData) {
    return <DashboardSkeleton />;
  }

  if (!loading && !patientsData && !appointmentsData && !invoicesData && !arReport) {
    return (
      <div
        className="-m-4 lg:-m-6 min-h-[calc(100vh-4rem)] flex items-center justify-center"
        style={{ background: `rgb(var(--hos-bg-primary))` }}
      >
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-rose-400/60" />
          <p className="text-sm text-white/50 font-medium">
            No se pudo conectar con el servidor. Verifique su conexion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-[calc(100vh-4rem)]"
      style={{ background: `rgb(var(--hos-bg-primary))` }}
    >
      <div className="space-y-6">
        {/* Header with personalized greeting */}
        <HealthOSGreeting />

        {/* Row 1: KPIs with sparklines and trend indicators */}
        <HealthOSKPIs
          totalPatients={totalPatients}
          appointments={appointments}
          invoices={invoices}
          arReport={arReport ?? null}
        />

        {/* Row 2: Clinical Activity + AI Smart Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <ClinicalActivity appointments={appointments} />
          </div>
          <div className="lg:col-span-2">
            <AIAssistantPanel
              appointments={appointments}
              invoices={invoices}
              arReport={arReport ?? null}
              totalPatients={totalPatients}
            />
          </div>
        </div>

        {/* Row 3: Hourly Consultation Distribution */}
        <InsightsChart data={hourlyData} />

        {/* Row 4: Revenue & Diagnoses Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div className="lg:col-span-1">
            <TopDiagnosesChart />
          </div>
        </div>

        {/* Row 5: Alerts & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlertsPanel
            appointments={appointments}
            invoices={invoices}
            arReport={arReport ?? null}
          />
          <RecentActivityTimeline appointments={appointments} invoices={invoices} />
        </div>

        {/* Row 6: Quick Actions */}
        <QuickActions />
      </div>
    </div>
  );
}
