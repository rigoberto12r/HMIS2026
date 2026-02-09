'use client';

import { KpiCard } from '@/components/ui/card';
import { CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAppointmentStats } from '@/hooks/useAppointments';

interface AppointmentStatsProps {
  dateFrom?: string;
  dateTo?: string;
}

export function AppointmentStats({ dateFrom, dateTo }: AppointmentStatsProps) {
  const { data: stats, isLoading } = useAppointmentStats(dateFrom, dateTo);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <KpiCard key={i} title="" value="--" icon={Clock} loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        title="Total Citas"
        value={stats?.total || 0}
        icon={CalendarDays}
        variant="primary"
      />
      <KpiCard
        title="Programadas"
        value={stats?.scheduled || 0}
        icon={Clock}
        variant="warning"
      />
      <KpiCard
        title="Completadas"
        value={stats?.completed || 0}
        icon={CheckCircle2}
        variant="success"
      />
      <KpiCard
        title="Canceladas"
        value={stats?.cancelled || 0}
        icon={XCircle}
        variant="danger"
      />
      <KpiCard
        title="No Asistió"
        value={stats?.no_show || 0}
        icon={XCircle}
        variant="default"
      />
    </div>
  );
}
