/**
 * ARAgingChart Component
 * Shows AR aging distribution or recent invoices chart
 */

import { TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatRD } from '../utils';
import type { ARAgingReport } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';

interface Props {
  arReport: ARAgingReport | null;
  invoices: Invoice[];
  ingresosMes: number;
}

export function ARAgingChart({ arReport, invoices, ingresosMes }: Props) {
  // AR aging chart data
  const agingChartData = arReport
    ? Object.entries(arReport.summary).map(([bucket, amount]) => ({
        bucket,
        monto: amount,
      }))
    : [];

  return (
    <Card>
      <CardHeader
        title={
          agingChartData.length > 0 ? 'Antiguedad de Cuentas por Cobrar' : 'Ingresos Recientes'
        }
        subtitle={
          agingChartData.length > 0
            ? 'Distribucion por periodo (RD$)'
            : 'Basado en facturas recientes'
        }
        action={
          <Badge variant="success" size="sm">
            <TrendingUp className="w-3 h-3" /> {formatRD(ingresosMes)}
          </Badge>
        }
      />
      <div className="h-64">
        {agingChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agingChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#64748B' }} />
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
                formatter={(value: number) => [formatRD(value), 'Monto']}
              />
              <Bar dataKey="monto" fill="#00897B" radius={[4, 4, 0, 0]} name="Monto" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={invoices.map((inv, idx) => ({
                label: `F${idx + 1}`,
                ingresos: inv.grand_total || 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
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
                formatter={(value: number) => [formatRD(value), 'Ingresos']}
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
        )}
      </div>
    </Card>
  );
}
