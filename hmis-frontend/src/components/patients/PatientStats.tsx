'use client';

import { Card } from '@/components/ui/card';
import { Users, UserCheck, Shield, TrendingUp } from 'lucide-react';
import { usePatientStats } from '@/hooks/usePatients';

export function PatientStats() {
  const { data: stats, isLoading } = usePatientStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5">
            <div className="animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-20 mb-2" />
              <div className="h-8 bg-neutral-200 rounded w-16" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Pacientes',
      value: stats?.total_patients || 0,
      icon: Users,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Nuevos (Este Mes)',
      value: stats?.new_this_month || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Activos',
      value: stats?.active_patients || 0,
      icon: UserCheck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Con Seguro',
      value: (stats as Record<string, number>)?.with_insurance || 0,
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-neutral-900">{stat.value.toLocaleString()}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
