'use client';

import { KpiCard } from '@/components/ui/card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  CalendarCheck,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  Stethoscope,
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

// ─── Mock Data ──────────────────────────────────────────

const weeklyPatients = [
  { dia: 'Lun', pacientes: 32 },
  { dia: 'Mar', pacientes: 28 },
  { dia: 'Mie', pacientes: 45 },
  { dia: 'Jue', pacientes: 38 },
  { dia: 'Vie', pacientes: 42 },
  { dia: 'Sab', pacientes: 18 },
  { dia: 'Dom', pacientes: 8 },
];

const revenueData = [
  { mes: 'Sep', ingresos: 820000 },
  { mes: 'Oct', ingresos: 950000 },
  { mes: 'Nov', ingresos: 880000 },
  { mes: 'Dic', ingresos: 1120000 },
  { mes: 'Ene', ingresos: 1050000 },
  { mes: 'Feb', ingresos: 1245000 },
];

const appointmentsByType = [
  { name: 'Consulta General', value: 45, color: '#0066CC' },
  { name: 'Especializada', value: 25, color: '#00897B' },
  { name: 'Control', value: 18, color: '#EA580C' },
  { name: 'Emergencia', value: 12, color: '#DC2626' },
];

const recentActivity = [
  { time: '08:45', event: 'Paciente Juan Perez registrado', type: 'paciente' },
  { time: '09:00', event: 'Cita confirmada - Dra. Martinez', type: 'cita' },
  { time: '09:15', event: 'Nota SOAP firmada - Enc. #1234', type: 'clinico' },
  { time: '09:30', event: 'Factura FAC-00000012 emitida', type: 'factura' },
  { time: '09:45', event: 'Dispensacion Amoxicilina 500mg', type: 'farmacia' },
  { time: '10:00', event: 'Check-in paciente Maria Lopez', type: 'paciente' },
  { time: '10:15', event: 'Orden de laboratorio creada', type: 'clinico' },
  { time: '10:30', event: 'Pago recibido RD$ 2,500', type: 'factura' },
];

const todaySummary = [
  { label: 'Consultas completadas', value: '12 / 24' },
  { label: 'Ingresos del dia', value: 'RD$ 87,400' },
  { label: 'Prescripciones emitidas', value: '18' },
  { label: 'Reclamaciones enviadas', value: '7' },
  { label: 'Pacientes en espera', value: '3' },
  { label: 'No-shows', value: '2' },
];

const activityTypeColors: Record<string, string> = {
  paciente: 'bg-primary-100 text-primary-600',
  cita: 'bg-secondary-100 text-secondary-600',
  clinico: 'bg-purple-100 text-purple-600',
  factura: 'bg-green-100 text-green-600',
  farmacia: 'bg-orange-100 text-orange-600',
};

// ─── Page ───────────────────────────────────────────────

export default function DashboardPage() {
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
          title="Pacientes del Dia"
          value={24}
          change="+3 vs ayer"
          changeType="positive"
          icon={<Users className="w-5 h-5" />}
          iconColor="bg-primary-50 text-primary-500"
        />
        <KpiCard
          title="Citas Pendientes"
          value={18}
          change="6 confirmadas"
          changeType="neutral"
          icon={<CalendarCheck className="w-5 h-5" />}
          iconColor="bg-secondary-50 text-secondary-500"
        />
        <KpiCard
          title="Facturas Emitidas"
          value="RD$ 145,200"
          change="+12% esta semana"
          changeType="positive"
          icon={<Receipt className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-600"
        />
        <KpiCard
          title="Alertas Farmacia"
          value={3}
          change="2 stock bajo"
          changeType="negative"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-orange-50 text-orange-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Patients Bar Chart */}
        <Card>
          <CardHeader
            title="Pacientes por Dia"
            subtitle="Ultima semana"
            action={
              <Badge variant="primary" size="sm">
                <TrendingUp className="w-3 h-3" /> +8%
              </Badge>
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPatients}>
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
          </div>
        </Card>

        {/* Revenue Line Chart */}
        <Card>
          <CardHeader
            title="Ingresos Mensuales"
            subtitle="Ultimos 6 meses (RD$)"
            action={
              <Badge variant="success" size="sm">
                <TrendingUp className="w-3 h-3" /> +18%
              </Badge>
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748B' }} />
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
                  formatter={(value: number) => [
                    `RD$ ${value.toLocaleString('es-DO')}`,
                    'Ingresos',
                  ]}
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
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Appointments by Type */}
        <Card>
          <CardHeader title="Citas por Tipo" subtitle="Distribucion de hoy" />
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
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader
            title="Actividad Reciente"
            action={
              <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Ver todo
              </button>
            }
          />
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {recentActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0"
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${activityTypeColors[item.type]}`}
                >
                  {item.type === 'paciente' && <Users className="w-3.5 h-3.5" />}
                  {item.type === 'cita' && <CalendarCheck className="w-3.5 h-3.5" />}
                  {item.type === 'clinico' && <Stethoscope className="w-3.5 h-3.5" />}
                  {item.type === 'factura' && <Receipt className="w-3.5 h-3.5" />}
                  {item.type === 'farmacia' && <Activity className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700 leading-snug">{item.event}</p>
                  <p className="text-2xs text-neutral-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader title="Resumen de Hoy" />
          <div className="space-y-2.5">
            {todaySummary.map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg"
              >
                <span className="text-sm text-neutral-600">{label}</span>
                <span className="font-semibold text-neutral-900 text-sm">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
