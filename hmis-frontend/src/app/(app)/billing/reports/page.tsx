'use client';

import { useState } from 'react';
import { Card, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  FileText,
  CreditCard,
  Wallet,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBillingStats, useBillingReport } from '@/hooks/useInvoices';

// ─── Types ──────────────────────────────────────────────

interface ReportFilters {
  reportType: 'sales' | 'collections' | 'pending' | 'ar_aging';
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week' | 'month';
}

interface SalesData {
  date: string;
  ventas: number;
  cobros: number;
  pendiente: number;
}

interface PaymentMethodData {
  name: string;
  value: number;
  color: string;
}

interface TopServiceData {
  service: string;
  count: number;
  revenue: number;
}

// ─── Mock Data Generators ───────────────────────────────

function generateMonthlySalesData(): SalesData[] {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months.map((month) => ({
    date: month,
    ventas: Math.floor(Math.random() * 500000) + 300000,
    cobros: Math.floor(Math.random() * 400000) + 250000,
    pendiente: Math.floor(Math.random() * 100000) + 50000,
  }));
}

function generatePaymentMethodData(): PaymentMethodData[] {
  return [
    { name: 'Efectivo', value: 45, color: '#10B981' },
    { name: 'Tarjeta', value: 35, color: '#3B82F6' },
    { name: 'Transferencia', value: 15, color: '#F59E0B' },
    { name: 'Seguro', value: 5, color: '#8B5CF6' },
  ];
}

function generateTopServicesData(): TopServiceData[] {
  return [
    { service: 'Consulta General', count: 245, revenue: 122500 },
    { service: 'Laboratorio', count: 189, revenue: 94500 },
    { service: 'Radiografía', count: 156, revenue: 234000 },
    { service: 'Ultrasonido', count: 123, revenue: 184500 },
    { service: 'Farmacia', count: 298, revenue: 89400 },
  ];
}

// ─── Component ──────────────────────────────────────────

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

export default function BillingReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: 'sales',
    dateFrom: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    groupBy: 'month',
  });

  const { data: stats, isLoading: statsLoading } = useBillingStats(
    filters.dateFrom,
    filters.dateTo
  );
  const { data: arAging, isLoading: arLoading } = useBillingReport(
    'ar_aging',
    filters.dateFrom,
    filters.dateTo
  );

  const monthlySalesData = generateMonthlySalesData();
  const paymentMethodData = generatePaymentMethodData();
  const topServicesData = generateTopServicesData();

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      // Mock export - in production, call API endpoint
      toast.success(`Exportando reporte en formato ${format.toUpperCase()}...`);
      // Example: await api.get(`/billing/reports/export?format=${format}&...filters`)
    } catch (error) {
      toast.error('Error al exportar el reporte');
    }
  };

  const arAgingData = arAging
    ? [
        { label: 'Corriente', value: arAging.current, color: '#10B981' },
        { label: '1-30 días', value: arAging.days_30, color: '#3B82F6' },
        { label: '31-60 días', value: arAging.days_60, color: '#F59E0B' },
        { label: '61-90 días', value: arAging.days_90, color: '#EF4444' },
        { label: '>90 días', value: arAging.over_90, color: '#DC2626' },
      ]
    : [];

  const serviceColumns: Column<TopServiceData>[] = [
    {
      key: 'service',
      header: 'Servicio',
      render: (item) => <span className="font-semibold">{item.service}</span>,
    },
    {
      key: 'count',
      header: 'Cantidad',
      render: (item) => item.count.toString(),
    },
    {
      key: 'revenue',
      header: 'Ingresos',
      render: (item) => (
        <span className="text-green-600 dark:text-green-400 font-semibold">
          {formatRD(item.revenue)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reportes de Facturación</h1>
          <p className="text-neutral-500">
            Análisis financiero, métricas y tendencias de facturación
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('excel')}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-neutral-500" />
            <div className="flex-1 flex gap-4 flex-wrap">
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.reportType}
                onChange={(e) =>
                  setFilters({ ...filters, reportType: e.target.value as ReportFilters['reportType'] })
                }
              >
                <option value="sales">Ventas</option>
                <option value="collections">Cobros</option>
                <option value="pending">Pendientes</option>
                <option value="ar_aging">Antigüedad de Saldos</option>
              </select>
              <input
                type="date"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
              <input
                type="date"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.groupBy}
                onChange={(e) =>
                  setFilters({ ...filters, groupBy: e.target.value as ReportFilters['groupBy'] })
                }
              >
                <option value="day">Por Día</option>
                <option value="week">Por Semana</option>
                <option value="month">Por Mes</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Facturado"
          value={formatRD(stats?.total_billed || 0)}
          icon={DollarSign}
          variant="default"
          loading={statsLoading}
        />
        <KpiCard
          title="Total Cobrado"
          value={formatRD(stats?.total_collected || 0)}
          icon={TrendingUp}
          variant="success"
          loading={statsLoading}
        />
        <KpiCard
          title="Pendiente de Cobro"
          value={formatRD(stats?.total_pending || 0)}
          icon={Calendar}
          variant="warning"
          loading={statsLoading}
        />
        <KpiCard
          title="Facturas"
          value={stats?.invoices_count?.toString() || '0'}
          icon={FileText}
          variant="primary"
          loading={statsLoading}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Trend Chart */}
        <Card className="lg:col-span-2">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tendencia de Ventas y Cobros</h2>
              <Badge variant="info">Últimos 12 meses</Badge>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySalesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cobrosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.1)"
                    className="dark:stroke-white/10"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="text-neutral-500"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="text-neutral-500"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700">
                          <p className="text-xs text-neutral-500 mb-2">{label}</p>
                          {payload.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-xs" style={{ color: entry.color }}>
                                {entry.name}:
                              </span>
                              <span className="text-sm font-semibold">
                                RD$ {entry.value?.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    name="Ventas"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    fill="url(#ventasGradient)"
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cobros"
                    name="Cobros"
                    stroke="#10B981"
                    strokeWidth={3}
                    fill="url(#cobrosGradient)"
                    dot={{ fill: '#10B981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pendiente"
                    name="Pendiente"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Payment Methods Pie Chart */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Métodos de Pago</h2>
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700">
                          <p className="text-sm font-semibold">{data.name}</p>
                          <p className="text-xs text-neutral-500">{data.value}%</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {paymentMethodData.map((method) => (
                <div key={method.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: method.color }}
                    />
                    <span>{method.name}</span>
                  </div>
                  <span className="font-semibold">{method.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* AR Aging Report */}
      {arAging && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Antigüedad de Cuentas por Cobrar</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAgingData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.1)"
                    className="dark:stroke-white/10"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="text-neutral-500"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="text-neutral-500"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700">
                          <p className="text-sm font-semibold">{payload[0].payload.label}</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatRD(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {arAgingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-4">
              {arAgingData.map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xs text-neutral-500 mb-1">{item.label}</p>
                  <p className="text-lg font-bold" style={{ color: item.color }}>
                    {formatRD(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Top Services Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Servicios Más Facturados</h2>
          <DataTable
            data={topServicesData}
            columns={serviceColumns}
            keyExtractor={(item) => item.service}
            loading={false}
            emptyMessage="No hay datos disponibles"
          />
        </div>
      </Card>
    </div>
  );
}
