'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoices, useBillingStats, type Invoice } from '@/hooks/useInvoices';
import { InvoiceStats, InvoiceTable, CreateInvoiceModal, CreditNoteModal } from '@/components/billing';
import PaymentModal from '@/components/payments/PaymentModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);

  // Fetch invoices with React Query
  const { data, isLoading, error, refetch } = useInvoices({ page, page_size: 10 });

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

  const handlePayment = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
  };

  const handleCreditNote = (invoice: Invoice) => {
    setCreditNoteInvoice(invoice);
  };

  const handleDownload = (invoice: Invoice) => {
    const token = localStorage.getItem('hmis_access_token');
    const tenantId = localStorage.getItem('hmis_tenant_id') || 'demo';

    fetch(`${API_BASE_URL}/billing/invoices/${invoice.id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error descargando PDF');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${invoice.invoice_number || invoice.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Error downloading invoice PDF:', err);
        toast.error('No se pudo descargar el PDF de la factura');
      });
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
        <Button onClick={() => setShowCreateInvoice(true)}>
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

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
      />

      {/* Payment Modal (Stripe) */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          isOpen={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => {
            setPaymentInvoice(null);
            refetch();
          }}
        />
      )}

      {/* Credit Note Modal */}
      <CreditNoteModal
        isOpen={!!creditNoteInvoice}
        onClose={() => setCreditNoteInvoice(null)}
        invoice={creditNoteInvoice}
      />
    </div>
  );
}
