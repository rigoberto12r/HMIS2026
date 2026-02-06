'use client';

import { useState } from 'react';
import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import {
  Plus,
  DollarSign,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Download,
  CreditCard,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────

interface Invoice {
  id: string;
  number: string;
  ncf: string;
  patient: string;
  date: string;
  due_date: string;
  amount: number;
  paid: number;
  insurance: string;
  status: string;
}

// ─── Mock Data ──────────────────────────────────────────

const mockInvoices: Invoice[] = [
  { id: '1', number: 'FAC-00000012', ncf: 'B0200000012', patient: 'Juan Perez', date: '06/02/2026', due_date: '06/03/2026', amount: 4500, paid: 4500, insurance: 'ARS Humano', status: 'pagada' },
  { id: '2', number: 'FAC-00000011', ncf: 'B0200000011', patient: 'Maria Rodriguez', date: '06/02/2026', due_date: '06/03/2026', amount: 2800, paid: 0, insurance: 'ARS Universal', status: 'pendiente' },
  { id: '3', number: 'FAC-00000010', ncf: 'B0100000010', patient: 'Carlos Gomez', date: '05/02/2026', due_date: '05/03/2026', amount: 12500, paid: 6000, insurance: 'Senasa', status: 'parcial' },
  { id: '4', number: 'FAC-00000009', ncf: 'B0200000009', patient: 'Ana Gonzalez', date: '05/02/2026', due_date: '05/03/2026', amount: 1500, paid: 1500, insurance: 'ARS Humano', status: 'pagada' },
  { id: '5', number: 'FAC-00000008', ncf: 'B0100000008', patient: 'Pedro Sanchez', date: '04/02/2026', due_date: '04/03/2026', amount: 8200, paid: 0, insurance: 'Senasa', status: 'pendiente' },
  { id: '6', number: 'FAC-00000007', ncf: 'B0200000007', patient: 'Laura Diaz', date: '15/01/2026', due_date: '15/02/2026', amount: 6700, paid: 0, insurance: 'ARS Palic', status: 'vencida' },
];

const weeklyRevenue = [
  { dia: 'Lun', ingresos: 45000, gastos: 12000 },
  { dia: 'Mar', ingresos: 38000, gastos: 9000 },
  { dia: 'Mie', ingresos: 52000, gastos: 15000 },
  { dia: 'Jue', ingresos: 41000, gastos: 11000 },
  { dia: 'Vie', ingresos: 48000, gastos: 13000 },
  { dia: 'Sab', ingresos: 22000, gastos: 6000 },
];

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;

// ─── Page ───────────────────────────────────────────────

export default function BillingPage() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const totalFacturado = mockInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCobrado = mockInvoices.reduce((sum, inv) => sum + inv.paid, 0);
  const pendienteCobro = totalFacturado - totalCobrado;
  const vencidas = mockInvoices.filter((inv) => inv.status === 'vencida').length;

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'No. Factura',
      sortable: true,
      width: '140px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">{row.number}</span>
      ),
    },
    {
      key: 'ncf',
      header: 'NCF',
      width: '130px',
      render: (row) => <span className="font-mono text-neutral-500 text-xs">{row.ncf}</span>,
    },
    {
      key: 'patient',
      header: 'Paciente',
      sortable: true,
      render: (row) => <span className="font-medium text-neutral-900">{row.patient}</span>,
    },
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      width: '100px',
      render: (row) => <span className="text-neutral-600 text-xs">{row.date}</span>,
    },
    {
      key: 'insurance',
      header: 'Aseguradora',
      render: (row) => <span className="text-neutral-600 text-xs">{row.insurance}</span>,
    },
    {
      key: 'amount',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-neutral-900">{formatRD(row.amount)}</span>
      ),
    },
    {
      key: 'paid',
      header: 'Pagado',
      align: 'right',
      render: (row) => (
        <span className={row.paid >= row.amount ? 'text-green-600 font-medium' : 'text-neutral-500'}>
          {formatRD(row.paid)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '110px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: () => (
        <Button variant="ghost" size="sm">
          <FileText className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Facturacion</h1>
          <p className="page-subtitle">Gestion de facturas, pagos y reclamaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            Reclamaciones
          </Button>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Facturado"
          value={formatRD(totalFacturado)}
          change="+12% vs mes anterior"
          changeType="positive"
          icon={<Receipt className="w-5 h-5" />}
          iconColor="bg-primary-50 text-primary-500"
        />
        <KpiCard
          title="Total Cobrado"
          value={formatRD(totalCobrado)}
          change={`${Math.round((totalCobrado / totalFacturado) * 100)}% del facturado`}
          changeType="neutral"
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-500"
        />
        <KpiCard
          title="Pendiente de Cobro"
          value={formatRD(pendienteCobro)}
          change={`${mockInvoices.filter((i) => i.status === 'pendiente').length} facturas`}
          changeType="negative"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Facturas Vencidas"
          value={vencidas}
          change="Requieren atencion"
          changeType="negative"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-red-50 text-red-500"
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader title="Ingresos vs Gastos" subtitle="Esta semana (RD$)" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}
                formatter={(value: number, name: string) => [
                  formatRD(value),
                  name === 'ingresos' ? 'Ingresos' : 'Gastos',
                ]}
              />
              <Bar dataKey="ingresos" fill="#0066CC" radius={[4, 4, 0, 0]} name="ingresos" />
              <Bar dataKey="gastos" fill="#E2E8F0" radius={[4, 4, 0, 0]} name="gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card padding="none">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="section-title">Listado de Facturas</h2>
        </div>
        <DataTable
          columns={columns}
          data={mockInvoices}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar por numero, paciente o aseguradora..."
          emptyMessage="No se encontraron facturas."
          className="p-4"
        />
      </Card>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        description="Ingrese los datos del pago recibido."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowPaymentModal(false)} leftIcon={<CreditCard className="w-4 h-4" />}>
              Registrar Pago
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Monto" type="number" placeholder="0.00" required />
          <Select
            label="Metodo de Pago"
            required
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'tarjeta', label: 'Tarjeta de Credito/Debito' },
              { value: 'transferencia', label: 'Transferencia Bancaria' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'seguro', label: 'Pago por Seguro' },
            ]}
            placeholder="Seleccionar metodo"
          />
          <Input label="Referencia" placeholder="Numero de referencia o recibo" />
          <Input label="Fecha de Pago" type="date" required />
        </div>
      </Modal>
    </div>
  );
}
