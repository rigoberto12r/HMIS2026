'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  Plus,
  DollarSign,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Download,
  CreditCard,
  FileText,
  BookOpen,
  XCircle,
  RotateCcw,
  FileCheck,
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
  invoice_number: string;
  fiscal_number: string | null;
  patient_id: string;
  grand_total: number;
  currency: string;
  status: string;
  created_at: string;
  due_date: string | null;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusMap: Record<string, string> = {
  draft: 'borrador',
  issued: 'emitida',
  paid: 'pagada',
  partial: 'parcial',
  cancelled: 'anulada',
  credit_note: 'nota_credito',
};

// ─── Page ───────────────────────────────────────────────

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [arReport, setARReport] = useState<ARAgingReport | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Formulario de pago
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  // Formulario de nota de credito
  const [cnReason, setCnReason] = useState('');

  // Formulario de anulacion
  const [voidReason, setVoidReason] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch Data ────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Invoice>>('/billing/invoices', {
        page: page,
        page_size: 10,
      });
      setInvoices(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Error cargando facturas:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchARReport = useCallback(async () => {
    try {
      const data = await api.get<ARAgingReport>('/billing/reports/ar-aging');
      setARReport(data);
    } catch {
      // AR report may fail if no invoices exist
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchARReport();
  }, [fetchInvoices, fetchARReport]);

  // ─── KPI Calculations ─────────────────────────────────

  const totalFacturado = invoices.reduce((sum, inv) => sum + inv.grand_total, 0);
  const totalCobrado = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.grand_total, 0);
  const pendienteCobro = arReport?.total_receivable ?? (totalFacturado - totalCobrado);
  const facturasVencidas = arReport?.items.filter((i) => i.days_outstanding > 30).length ?? 0;

  // Datos para grafico de buckets del AR aging
  const agingChartData = arReport
    ? Object.entries(arReport.summary).map(([bucket, amount]) => ({
        bucket,
        monto: amount,
      }))
    : [];

  // ─── Actions ───────────────────────────────────────────

  const handleRecordPayment = async () => {
    if (!selectedInvoice || !paymentAmount || !paymentMethod) return;
    setSubmitting(true);
    try {
      await api.post('/billing/payments', {
        invoice_id: selectedInvoice.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        reference_number: paymentRef || null,
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentRef('');
      fetchInvoices();
      fetchARReport();
    } catch (err) {
      console.error('Error registrando pago:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCreditNote = async () => {
    if (!selectedInvoice || !cnReason) return;
    setSubmitting(true);
    try {
      await api.post('/billing/credit-notes', {
        original_invoice_id: selectedInvoice.id,
        reason: cnReason,
        full_reversal: true,
      });
      setShowCreditNoteModal(false);
      setCnReason('');
      fetchInvoices();
      fetchARReport();
    } catch (err) {
      console.error('Error creando nota de credito:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!selectedInvoice || !voidReason) return;
    setSubmitting(true);
    try {
      await api.post(`/billing/invoices/${selectedInvoice.id}/void`, {
        reason: voidReason,
      });
      setShowVoidModal(false);
      setVoidReason('');
      fetchInvoices();
      fetchARReport();
    } catch (err) {
      console.error('Error anulando factura:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/billing/invoices/${invoice.id}/pdf`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error descargando PDF:', err);
    }
  };

  // ─── Table Columns ─────────────────────────────────────

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'No. Factura',
      sortable: true,
      width: '140px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">{row.invoice_number}</span>
      ),
    },
    {
      key: 'fiscal_number',
      header: 'NCF',
      width: '140px',
      render: (row) => (
        <span className="font-mono text-neutral-500 text-xs">{row.fiscal_number || '-'}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Paciente',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-neutral-900">{row.customer_name || 'N/A'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      width: '100px',
      render: (row) => <span className="text-neutral-600 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'grand_total',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-neutral-900">{formatRD(row.grand_total)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '110px',
      render: (row) => <StatusBadge status={statusMap[row.status] || row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            title="Descargar PDF"
            onClick={() => handleDownloadPdf(row)}
          >
            <FileText className="w-4 h-4" />
          </Button>
          {(row.status === 'issued' || row.status === 'partial') && (
            <Button
              variant="ghost"
              size="sm"
              title="Registrar Pago"
              onClick={() => {
                setSelectedInvoice(row);
                setShowPaymentModal(true);
              }}
            >
              <CreditCard className="w-4 h-4" />
            </Button>
          )}
          {row.status !== 'cancelled' && row.status !== 'credit_note' && (
            <Button
              variant="ghost"
              size="sm"
              title="Nota de Credito"
              onClick={() => {
                setSelectedInvoice(row);
                setShowCreditNoteModal(true);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {(row.status === 'draft' || row.status === 'issued') && (
            <Button
              variant="ghost"
              size="sm"
              title="Anular Factura"
              onClick={() => {
                setSelectedInvoice(row);
                setShowVoidModal(true);
              }}
            >
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Facturacion y Contabilidad</h1>
          <p className="page-subtitle">Facturas, pagos, notas de credito y reportes fiscales</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<BookOpen className="w-4 h-4" />}
            onClick={() => window.location.href = '/billing/journal'}
          >
            Libro Diario
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileCheck className="w-4 h-4" />}
            onClick={() => window.location.href = '/billing/reports'}
          >
            Reportes DGII
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
          change={`${total} facturas`}
          changeType="neutral"
          icon={<Receipt className="w-5 h-5" />}
          iconColor="bg-primary-50 text-primary-500"
        />
        <KpiCard
          title="Total Cobrado"
          value={formatRD(totalCobrado)}
          change={totalFacturado > 0 ? `${Math.round((totalCobrado / totalFacturado) * 100)}% del facturado` : '0%'}
          changeType="neutral"
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-500"
        />
        <KpiCard
          title="Pendiente de Cobro"
          value={formatRD(pendienteCobro)}
          change="Cuentas por cobrar"
          changeType="negative"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Vencidas (>30 dias)"
          value={facturasVencidas}
          change="Requieren atencion"
          changeType="negative"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconColor="bg-red-50 text-red-500"
        />
      </div>

      {/* AR Aging Chart */}
      {agingChartData.length > 0 && (
        <Card>
          <CardHeader title="Antiguedad de Cuentas por Cobrar" subtitle="Distribucion por periodo (RD$)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}
                  formatter={(value: number) => [formatRD(value), 'Monto']}
                />
                <Bar dataKey="monto" fill="#0066CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Invoices Table */}
      <Card padding="none">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="section-title">Listado de Facturas</h2>
          <span className="text-xs text-neutral-500">{total} facturas en total</span>
        </div>
        <DataTable
          columns={columns}
          data={invoices}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar por numero, paciente o NCF..."
          emptyMessage={loading ? 'Cargando facturas...' : 'No se encontraron facturas.'}
          className="p-4"
        />
      </Card>

      {/* ─── Payment Modal ──────────────────────────────── */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        description={`Factura ${selectedInvoice?.invoice_number} - Total: ${selectedInvoice ? formatRD(selectedInvoice.grand_total) : ''}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={!paymentAmount || !paymentMethod || submitting}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              {submitting ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Monto"
            type="number"
            placeholder="0.00"
            required
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <Select
            label="Metodo de Pago"
            required
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: 'cash', label: 'Efectivo' },
              { value: 'card', label: 'Tarjeta de Credito/Debito' },
              { value: 'transfer', label: 'Transferencia Bancaria' },
              { value: 'check', label: 'Cheque' },
              { value: 'insurance', label: 'Pago por Seguro' },
            ]}
            placeholder="Seleccionar metodo"
          />
          <Input
            label="Referencia"
            placeholder="Numero de referencia o recibo"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
        </div>
      </Modal>

      {/* ─── Credit Note Modal ──────────────────────────── */}
      <Modal
        isOpen={showCreditNoteModal}
        onClose={() => setShowCreditNoteModal(false)}
        title="Crear Nota de Credito"
        description={`Reversa completa de Factura ${selectedInvoice?.invoice_number}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreditNoteModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCreditNote}
              disabled={cnReason.length < 10 || submitting}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              variant="warning"
            >
              {submitting ? 'Procesando...' : 'Emitir Nota de Credito'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 text-yellow-800 rounded-lg p-3 text-sm">
            Esta accion creara una nota de credito NCF tipo 04 y generara el asiento contable correspondiente.
          </div>
          <Input
            label="Motivo de la nota de credito"
            placeholder="Describa el motivo (minimo 10 caracteres)..."
            required
            value={cnReason}
            onChange={(e) => setCnReason(e.target.value)}
          />
          {selectedInvoice && (
            <div className="bg-neutral-50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>Factura:</strong> {selectedInvoice.invoice_number}</p>
              <p><strong>NCF:</strong> {selectedInvoice.fiscal_number || 'N/A'}</p>
              <p><strong>Monto a acreditar:</strong> {formatRD(selectedInvoice.grand_total)}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Void Invoice Modal ─────────────────────────── */}
      <Modal
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        title="Anular Factura"
        description={`Anulacion de Factura ${selectedInvoice?.invoice_number}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowVoidModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleVoidInvoice}
              disabled={voidReason.length < 10 || submitting}
              leftIcon={<XCircle className="w-4 h-4" />}
              variant="danger"
            >
              {submitting ? 'Anulando...' : 'Confirmar Anulacion'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 text-red-800 rounded-lg p-3 text-sm">
            Esta accion es irreversible. La factura sera marcada como anulada y se registrara en el reporte 609 de la DGII.
          </div>
          <Input
            label="Motivo de anulacion"
            placeholder="Describa el motivo (minimo 10 caracteres)..."
            required
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
