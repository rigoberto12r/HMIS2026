'use client';

import { Card, KpiCard } from '@/components/ui/card';
import { Receipt, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

interface InvoiceStatsProps {
  totalFacturado: number;
  totalCobrado: number;
  pendienteCobro: number;
  facturasVencidas: number;
  loading?: boolean;
}

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

export function InvoiceStats({
  totalFacturado,
  totalCobrado,
  pendienteCobro,
  facturasVencidas,
  loading = false,
}: InvoiceStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Facturado"
        value={formatRD(totalFacturado)}
        icon={Receipt}
        variant="default"
        loading={loading}
      />
      <KpiCard
        title="Total Cobrado"
        value={formatRD(totalCobrado)}
        icon={DollarSign}
        variant="success"
        loading={loading}
      />
      <KpiCard
        title="Pendiente de Cobro"
        value={formatRD(pendienteCobro)}
        icon={TrendingUp}
        variant="warning"
        loading={loading}
      />
      <KpiCard
        title="Facturas Vencidas"
        value={facturasVencidas.toString()}
        icon={AlertTriangle}
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
