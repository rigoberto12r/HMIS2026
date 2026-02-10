/**
 * BillingTab Component
 * Displays patient invoices/billing history
 */

import { Card, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import type { Invoice } from '@/hooks/useInvoices';

interface Props {
  invoices: Invoice[];
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: currency || 'DOP',
  }).format(amount);
}

export function BillingTab({ invoices, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Facturas" />
      {invoices.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay facturas registradas para este paciente.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">No. Factura</th>
                <th className="table-header px-4 py-3 text-left">Fecha</th>
                <th className="table-header px-4 py-3 text-left">Descripcion</th>
                <th className="table-header px-4 py-3 text-right">Monto</th>
                <th className="table-header px-4 py-3 text-left">Vencimiento</th>
                <th className="table-header px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {formatDate(invoice.created_at)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {invoice.customer_name || '---'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900">
                    {formatCurrency(invoice.grand_total, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {formatDate(invoice.due_date || '')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
