/**
 * AppointmentsTab Component
 * Displays patient appointments history
 */

import { Calendar } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import type { Appointment } from '@/hooks/usePatientDetail';

interface Props {
  appointments: Appointment[];
  loading?: boolean;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AppointmentsTab({ appointments, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Historial de Citas"
        action={
          <Button size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
            Nueva Cita
          </Button>
        }
      />
      {appointments.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay citas registradas para este paciente.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">Fecha y Hora</th>
                <th className="table-header px-4 py-3 text-left">Tipo</th>
                <th className="table-header px-4 py-3 text-left">Proveedor</th>
                <th className="table-header px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-mono text-xs">
                    {formatDateTime(apt.scheduled_at)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{apt.appointment_type}</td>
                  <td className="px-4 py-3 text-neutral-600">{apt.provider_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={apt.status} />
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
