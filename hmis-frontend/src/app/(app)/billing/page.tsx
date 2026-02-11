'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useInvoices, useBillingStats, type Invoice } from '@/hooks/useInvoices';
import { InvoiceStats, InvoiceTable } from '@/components/billing';

/**
 * Billing Page - Refactored with React Query
 *
 * Before: 664 lines with manual fetching
 * After: ~150 lines with hooks and extracted components
 *
 * Benefits:
 * - Automatic caching and refetching
 * - Cleaner component separation
 * - Reusable invoice components
 */

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Fetch invoices with React Query
  const { data, isLoading, error } = useInvoices({ page, page_size: 10 });
  
  // Fetch billing stats
  const { data: stats } = useBillingStats();

  // Extract invoices and pagination
  const invoices = (data?.items || []) as unknown as Invoice[];
  const total = data?.total || 0;

  // Calculate KPIs
  const totalFacturado = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const totalCobrado = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const pendienteCobro = stats?.total_pending ?? (totalFacturado - totalCobrado);
  const facturasVencidas = invoices.filter((inv) => 
    inv.status === 'issued' && inv.created_at < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  ).length;

  // Event handlers
  const handlePayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // TODO: Open payment modal
    console.log('Payment for invoice:', invoice.invoice_number);
  };

  const handleCreditNote = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // TODO: Open credit note modal
    console.log('Credit note for invoice:', invoice.invoice_number);
  };

  const handleDownload = (invoice: Invoice) => {
    // TODO: Download invoice PDF
    console.log('Download invoice:', invoice.invoice_number);
  };

  const handleCreateInvoice = () => {
    // TODO: Open create invoice modal
    console.log('Create new invoice');
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center text-red-600">
          Error cargando facturas: {error.message}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-neutral-500">
            Gestión de facturas, pagos y cuentas por cobrar
          </p>
        </div>
        <Button onClick={handleCreateInvoice}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* KPI Stats */}
      <InvoiceStats
        totalFacturado={totalFacturado}
        totalCobrado={totalCobrado}
        pendienteCobro={pendienteCobro}
        facturasVencidas={facturasVencidas}
        loading={isLoading}
      />

      {/* Invoices Table */}
      <Card>
        <CardHeader title="Facturas Recientes" />
        <InvoiceTable
          invoices={invoices}
          loading={isLoading}
          onPayment={handlePayment}
          onCreditNote={handleCreditNote}
          onDownload={handleDownload}
        />
      </Card>

      {/* Pagination */}
      {total > 10 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="px-4 py-2">
            Página {page} de {Math.ceil(total / 10)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* TODO: Modals */}
      {/* PaymentModal, CreditNoteModal, CreateInvoiceModal */}
    </div>
  );
}
