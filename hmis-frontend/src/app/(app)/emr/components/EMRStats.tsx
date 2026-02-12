'use client';

import { FileText, Clock, CheckCircle2 } from 'lucide-react';

interface EMRStatsProps {
  today: number;
  inProgress: number;
  completed: number;
}

const stats = [
  { key: 'today', label: 'Encuentros Hoy', icon: FileText, color: 'text-primary-600 bg-primary-50' },
  { key: 'inProgress', label: 'En Progreso', icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  { key: 'completed', label: 'Completados', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
] as const;

export function EMRStats({ today, inProgress, completed }: EMRStatsProps) {
  const values: Record<string, number> = { today, inProgress, completed };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="bg-white rounded-lg border border-neutral-200 p-3 flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-neutral-900">{values[key]}</p>
            <p className="text-2xs text-neutral-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
