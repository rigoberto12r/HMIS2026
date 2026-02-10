/**
 * AppointmentsPieChart Component
 * Pie chart showing appointment distribution by type
 */

import { Card, CardHeader } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { appointmentTypeColors } from '../utils';
import type { Appointment } from '@/hooks/useDashboard';

interface Props {
  appointments: Appointment[];
}

export function AppointmentsPieChart({ appointments }: Props) {
  // Appointment type distribution
  const appointmentTypeMap = appointments.reduce<Record<string, number>>((acc, apt) => {
    const type = apt.type || 'Otro';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const appointmentsByType = Object.entries(appointmentTypeMap).map(([name, value], idx) => ({
    name,
    value,
    color: appointmentTypeColors[idx % appointmentTypeColors.length].color,
  }));

  return (
    <Card>
      <CardHeader title="Citas por Tipo" subtitle="Distribucion actual" />
      {appointmentsByType.length > 0 ? (
        <>
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={appointmentsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {appointmentsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {appointmentsByType.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-neutral-600 truncate">{item.name}</span>
                <span className="font-semibold text-neutral-800 ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-52 flex items-center justify-center">
          <p className="text-sm text-neutral-400">Sin datos de citas disponibles</p>
        </div>
      )}
    </Card>
  );
}
