'use client';

import { useState, useEffect, useCallback } from 'react';
import { KpiCard } from '@/components/ui/card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { type Invoice } from '@/hooks/useInvoices';
import {
  Users,
  CalendarCheck,
  Receipt,
  DollarSign,
  TrendingUp,
  Clock,
  Stethoscope,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  document_number: string;
  gender: string;
  age: number;
  phone: string;
  email: string;
  status: string;
  insurance: string;
  last_visit: string;
}

interface Appointment {
  id: string;
  time: string;
  patient: string;
  patient_name?: string;
  provider: string;
  type: string;
  status: string;
  duration: string;
  scheduled_date?: string;
  scheduled_time?: string;
  notes?: string;
  created_at?: string;
}


interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ARAgingReport {
  generated_at: string;
  currency: string;
  items: Array<{
    invoice_number: string;
    patient_name: string;
    balance: number;
    days_outstanding: number;
    aging_bucket: string;
  }>;
  summary: Record<string, number>;
  total_receivable: number;
}

// ─── Helpers ────────────────────────────────────────────

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return dateStr;
  }
};

const isToday = (dateStr: string | undefined): boolean => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
};

const appointmentStatusColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-600',
  confirmada: 'bg-blue-100 text-blue-600',
  en_progreso: 'bg-primary-100 text-primary-600',
  completada: 'bg-green-100 text-green-600',
  cancelada: 'bg-neutral-100 text-neutral-500',
};

// Placeholder chart data (will be replaced with real-time data in future)
const weeklyChartPlaceholder = [
  { dia: 'Lun', pacientes: 0 },
  { dia: 'Mar', pacientes: 0 },
  { dia: 'Mie', pacientes: 0 },
  { dia: 'Jue', pacientes: 0 },
  { dia: 'Vie', pacientes: 0 },
  { dia: 'Sab', pacientes: 0 },
  { dia: 'Dom', pacientes: 0 },
];

const appointmentTypeColors = [
  { color: '#0066CC' },
  { color: '#00897B' },
  { color: '#EA580C' },
  { color: '#DC2626' },
  { color: '#7C3AED' },
];

// ─── Page ───────────────────────────────────────────────

export default function DashboardPage() {
  // ─── State ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API data
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [totalAppointments, setTotalAppointments] = useState<number>(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [arReport, setARReport] = useState<ARAgingReport | null>(null);

  // ─── Data Fetching ────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      api.get<PaginatedResponse<Patient>>('/patients/search', { page: 1, page_size: 5 }),
      api.get<PaginatedResponse<Appointment>>('/appointments', { page: 1, page_size: 5 }),
      api.get<PaginatedResponse<Invoice>>('/billing/invoices', { page: 1, page_size: 5 }),
      api.get<ARAgingReport>('/billing/reports/ar-aging'),
    ]);

    // Patients
    if (results[0].status === 'fulfilled') {
      const patientsData = results[0].value;
      setTotalPatients(patientsData.total);
      setRecentPatients(patientsData.items);
    } else {
      console.error('Error cargando pacientes:', results[0].reason);
      setTotalPatients(0);
      setRecentPatients([]);
    }

    // Appointments
    if (results[1].status === 'fulfilled') {
      const appointmentsData = results[1].value;
      setAppointments(appointmentsData.items);
      setTotalAppointments(appointmentsData.total);
    } else {
      console.error('Error cargando citas:', results[1].reason);
      setAppointments([]);
      setTotalAppointments(0);
    }

    // Invoices
    if (results[2].status === 'fulfilled') {
      const invoicesData = results[2].value;
      setInvoices(invoicesData.items);
      setTotalInvoices(invoicesData.total);
    } else {
      console.error('Error cargando facturas:', results[2].reason);
      setInvoices([]);
      setTotalInvoices(0);
    }

    // AR Aging
    if (results[3].status === 'fulfilled') {
      setARReport(results[3].value);
    } else {
      console.error('Error cargando reporte CxC:', results[3].reason);
      setARReport(null);
    }

    // If all failed, show general error
    const allFailed = results.every((r) => r.status === 'rejected');
    if (allFailed) {
      setError('No se pudo conectar con el servidor. Verifique su conexion.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ─── KPI Calculations ─────────────────────────────────────

  const todayAppointments = appointments.filter(
    (apt) => isToday(apt.scheduled_date) || isToday(apt.created_at)
  );
  const citasHoy = todayAppointments.length > 0 ? todayAppointments.length : totalAppointments;

  const ingresosMes = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

  const cuentasPorCobrar = arReport?.total_receivable ?? 0;

  // Appointment type distribution for pie chart
  const appointmentTypeMap = appointments.reduce<Record<string, number>>((acc, apt) => {
    const type = apt.type || 'Otro';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const appointmentsByType = Object.entries(appointmentTypeMap).map(([name, value], idx) => ({
    name,
    value,
    color: appointmentTypeColors[idx % appointmentTypeColors.length].color,
  }));

  // AR aging chart data
  const agingChartData = arReport
    ? Object.entries(arReport.summary).map(([bucket, amount]) => ({
        bucket,
        monto: amount,
      }))
    : [];

  // ─── Loading State ────────────────────────────────────────

  if (loading) {
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

  // ─── Error State ──────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Panel Principal</h1>
          <p className="page-subtitle">Vista general del sistema hospitalario</p>
        </div>
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-neutral-700 font-medium">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium underline"
            >
              Reintentar
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Panel Principal</h1>
        <p className="page-subtitle">Vista general del sistema hospitalario</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pacientes Registrados"
          value={totalPatients}
          change={`${recentPatients.length} recientes`}
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
          change={arReport ? `${arReport.items.length} pendientes` : 'Sin datos'}
          changeType={cuentasPorCobrar > 0 ? 'negative' : 'neutral'}
          icon={DollarSign}
          iconColor="bg-orange-50 text-orange-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* Weekly Patients Bar Chart (placeholder with note) */}
        <Card>
          <CardHeader
            title="Pacientes por Dia"
            subtitle="Ultima semana"
            action={
              <Badge variant="primary" size="sm" className="hidden sm:inline-flex">
                <TrendingUp className="w-3 h-3" /> {totalPatients} total
              </Badge>
            }
          />
          <div className="h-64 relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartPlaceholder}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                  }}
                />
                <Bar
                  dataKey="pacientes"
                  fill="#0066CC"
                  radius={[4, 4, 0, 0]}
                  name="Pacientes"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <p className="text-sm text-neutral-500 font-medium text-center px-4">
                Datos en tiempo real proximamente
              </p>
            </div>
          </div>
        </Card>

        {/* AR Aging or Revenue Chart */}
        <Card>
          <CardHeader
            title={agingChartData.length > 0 ? 'Antiguedad de Cuentas por Cobrar' : 'Ingresos Recientes'}
            subtitle={agingChartData.length > 0 ? 'Distribucion por periodo (RD$)' : 'Basado en facturas recientes'}
            action={
              <Badge variant="success" size="sm">
                <TrendingUp className="w-3 h-3" /> {formatRD(ingresosMes)}
              </Badge>
            }
          />
          <div className="h-64">
            {agingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                    }}
                    formatter={(value: number) => [formatRD(value), 'Monto']}
                  />
                  <Bar dataKey="monto" fill="#00897B" radius={[4, 4, 0, 0]} name="Monto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={invoices.map((inv, idx) => ({
                    label: `F${idx + 1}`,
                    ingresos: inv.grand_total || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                    }}
                    formatter={(value: number) => [formatRD(value), 'Ingresos']}
                  />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    stroke="#00897B"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#00897B' }}
                    name="Ingresos"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Appointments by Type */}
        <Card>
          <CardHeader title="Citas por Tipo" subtitle="Distribucion actual" />
          {appointmentsByType.length > 0 ? (
            <>
              <div className="h-52 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={appointmentsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {appointmentsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '13px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {appointmentsByType.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-neutral-600 truncate">{item.name}</span>
                    <span className="font-semibold text-neutral-800 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <p className="text-sm text-neutral-400">Sin datos de citas disponibles</p>
            </div>
          )}
        </Card>

        {/* Recent Activity - Last 5 Appointments */}
        <Card>
          <CardHeader
            title="Actividad Reciente"
            action={
              <button
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                onClick={() => (window.location.href = '/appointments')}
              >
                Ver todo
              </button>
            }
          />
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {appointments.length > 0 ? (
              appointments.map((apt, idx) => {
                const patientName = apt.patient_name || apt.patient || 'Paciente';
                const displayTime = apt.scheduled_time || apt.time || formatTime(apt.created_at || '');
                const statusClass = appointmentStatusColors[apt.status] || 'bg-neutral-100 text-neutral-500';

                return (
                  <div
                    key={apt.id || idx}
                    className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0"
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${statusClass}`}
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700 leading-snug">
                        {patientName} - {apt.type || 'Cita'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {displayTime && (
                          <p className="text-2xs text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {displayTime}
                          </p>
                        )}
                        <StatusBadge status={apt.status} />
                      </div>
                      {apt.provider && (
                        <p className="text-2xs text-neutral-400 mt-0.5 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" /> {apt.provider}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-neutral-400">No hay citas recientes</p>
              </div>
            )}
          </div>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader title="Resumen General" />
          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Total pacientes</span>
              <span className="font-semibold text-neutral-900 text-sm">{totalPatients}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Citas programadas</span>
              <span className="font-semibold text-neutral-900 text-sm">{totalAppointments}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Facturas emitidas</span>
              <span className="font-semibold text-neutral-900 text-sm">{totalInvoices}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Ingresos facturados</span>
              <span className="font-semibold text-neutral-900 text-sm">{formatRD(ingresosMes)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Cuentas por cobrar</span>
              <span className="font-semibold text-neutral-900 text-sm">{formatRD(cuentasPorCobrar)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
              <span className="text-sm text-neutral-600">Facturas vencidas</span>
              <span className="font-semibold text-neutral-900 text-sm">
                {arReport?.items.filter((i) => i.days_outstanding > 30).length ?? 0}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
