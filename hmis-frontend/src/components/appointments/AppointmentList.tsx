'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, UserCheck, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { Appointment } from '@/hooks/useAppointments';
import { useUpdateAppointmentStatus, useCheckInAppointment } from '@/hooks/useAppointments';

interface AppointmentListProps {
  appointments: Appointment[];
  loading: boolean;
}

const STATUS_CONFIG = {
  scheduled: { label: 'Programada', variant: 'warning' as const, icon: Clock },
  confirmed: { label: 'Confirmada', variant: 'info' as const, icon: UserCheck },
  checked_in: { label: 'En Espera', variant: 'primary' as const, icon: Clock },
  in_progress: { label: 'En Consulta', variant: 'primary' as const, icon: Play },
  completed: { label: 'Completada', variant: 'success' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'danger' as const, icon: XCircle },
  no_show: { label: 'No Asistió', variant: 'default' as const, icon: AlertCircle },
};

export function AppointmentList({ appointments, loading }: AppointmentListProps) {
  const checkIn = useCheckInAppointment();
  const updateStatus = useUpdateAppointmentStatus();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-neutral-200 rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-neutral-500">No hay citas para el período seleccionado</p>
      </Card>
    );
  }

  const handleCheckIn = async (appointmentId: string) => {
    await checkIn.mutateAsync(appointmentId);
  };

  const handleComplete = async (appointmentId: string) => {
    await updateStatus.mutateAsync({ id: appointmentId, status: 'completed' });
  };

  return (
    <div className="space-y-3">
      {appointments.map((apt) => {
        const config = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
        const Icon = config.icon;

        return (
          <Card key={apt.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={config.variant}>
                    <Icon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Badge>
                  <span className="text-xs text-neutral-400">
                    {new Date(apt.appointment_datetime).toLocaleString('es-DO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <h3 className="font-semibold text-neutral-900">{apt.patient_name || 'Paciente Desconocido'}</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {apt.appointment_type} • {apt.provider_name || 'Sin Proveedor'}
                </p>
                {apt.reason && <p className="text-sm text-neutral-600 mt-2">{apt.reason}</p>}
              </div>

              <div className="flex gap-2">
                {apt.status === 'confirmed' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCheckIn(apt.id)}
                    disabled={checkIn.isPending}
                  >
                    Check-in
                  </Button>
                )}
                {apt.status === 'in_progress' && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleComplete(apt.id)}
                    disabled={updateStatus.isPending}
                  >
                    Completar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
