/**
 * WeeklyPatientsChart Component
 * Bar chart showing patients per day (placeholder with real-time data coming soon)
 */

import { TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { weeklyChartPlaceholder } from '../utils';

interface Props {
  totalPatients: number;
}

export function WeeklyPatientsChart({ totalPatients }: Props) {
  return (
    <Card>
      <CardHeader
        title="Pacientes por Dia"
        subtitle="Ultima semana"
        action={
          <Badge variant="primary" size="sm" className="hidden sm:inline-flex">
            <TrendingUp className="w-3 h-3" /> {totalPatients} total
          </Badge>
        }
      />
      <div className="h-64 relative overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyChartPlaceholder}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="pacientes" fill="#0066CC" radius={[4, 4, 0, 0]} name="Pacientes" />
          </BarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
          <p className="text-sm text-neutral-500 font-medium text-center px-4">
            Datos en tiempo real proximamente
          </p>
        </div>
      </div>
    </Card>
  );
}
