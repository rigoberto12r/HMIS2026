/**
 * RecentActivity Component
 * List of recent appointments
 */

import { CalendarCheck, Clock, Stethoscope } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { appointmentStatusColors, formatTime } from '../utils';
import type { Appointment } from '@/hooks/useDashboard';

interface Props {
  appointments: Appointment[];
}

export function RecentActivity({ appointments }: Props) {
  return (
    <Card>
      <CardHeader
        title="Actividad Reciente"
        action={
          <button
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            onClick={() => (window.location.href = '/appointments')}
          >
            Ver todo
          </button>
        }
      />
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {appointments.length > 0 ? (
          appointments.map((apt, idx) => {
            const patientName = apt.patient_name || apt.patient || 'Paciente';
            const displayTime =
              apt.scheduled_time || apt.time || formatTime(apt.created_at || '');
            const statusClass =
              appointmentStatusColors[apt.status] || 'bg-neutral-100 text-neutral-500';

            return (
              <div
                key={apt.id || idx}
                className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0"
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${statusClass}`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700 leading-snug">
                    {patientName} - {apt.type || 'Cita'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {displayTime && (
                      <p className="text-2xs text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {displayTime}
                      </p>
                    )}
                    <StatusBadge status={apt.status} />
                  </div>
                  {apt.provider && (
                    <p className="text-2xs text-neutral-400 mt-0.5 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" /> {apt.provider}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-neutral-400">No hay citas recientes</p>
          </div>
        )}
      </div>
    </Card>
  );
}
