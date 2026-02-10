/**
 * GeneralSummary Component
 * Summary widget with key metrics
 */

import { Card, CardHeader } from '@/components/ui/card';
import { formatRD } from '../utils';
import type { ARAgingReport } from '@/hooks/useDashboard';

interface Props {
  totalPatients: number;
  totalAppointments: number;
  totalInvoices: number;
  ingresosMes: number;
  cuentasPorCobrar: number;
  arReport: ARAgingReport | null;
}

export function GeneralSummary({
  totalPatients,
  totalAppointments,
  totalInvoices,
  ingresosMes,
  cuentasPorCobrar,
  arReport,
}: Props) {
  const facturasVencidas = arReport?.items.filter((i) => i.days_outstanding > 30).length ?? 0;

  return (
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
          <span className="font-semibold text-neutral-900 text-sm">
            {formatRD(cuentasPorCobrar)}
          </span>
        </div>
        <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
          <span className="text-sm text-neutral-600">Facturas vencidas</span>
          <span className="font-semibold text-neutral-900 text-sm">{facturasVencidas}</span>
        </div>
      </div>
    </Card>
  );
}
