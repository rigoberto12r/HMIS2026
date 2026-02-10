'use client';

import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, CreditCard, FileText } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  fiscal_number: string | null;
  patient_id: string;
  grand_total: number;
  currency: string;
  status: string;
  created_at: string;
  customer_name: string | null;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  onPayment: (invoice: Invoice) => void;
  onCreditNote: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
}

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
};

export function InvoiceTable({
  invoices,
  loading,
  onPayment,
  onCreditNote,
  onDownload,
}: InvoiceTableProps) {
  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Número',
      render: (invoice) => invoice.invoice_number || '-',
    },
    {
      key: 'fiscal_number',
      header: 'NCF',
      render: (invoice) => invoice.fiscal_number || '-',
    },
    {
      key: 'customer_name',
      header: 'Paciente',
      render: (invoice) => invoice.customer_name || '-',
    },
    {
      key: 'grand_total',
      header: 'Monto',
      render: (invoice) => formatRD(invoice.grand_total),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (invoice) => (
        <StatusBadge status={invoice.status}>
          {statusMap[invoice.status] || invoice.status}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      header: 'Fecha',
      render: (invoice) => formatDate(invoice.created_at),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (invoice) => (
        <div className="flex gap-2">
          {invoice.status === 'issued' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPayment(invoice)}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Pagar
            </Button>
          )}
          {invoice.status === 'paid' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreditNote(invoice)}
            >
              <FileText className="w-4 h-4 mr-1" />
              N/C
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownload(invoice)}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={invoices}
      columns={columns}
      keyExtractor={(invoice) => invoice.id}
      loading={loading}
      emptyMessage="No hay facturas registradas"
    />
  );
}
