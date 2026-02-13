'use client';

import { motion } from 'framer-motion';
import type { Appointment } from '@/hooks/useDashboard';
import { mapToClinicalStatus, clinicalStatusColors, formatTime } from '../utils';

interface ClinicalActivityProps {
  appointments: Appointment[];
}

export function ClinicalActivity({ appointments }: ClinicalActivityProps) {
  const sorted = [...appointments].sort((a, b) => {
    const order = { active: 0, waiting: 1, completed: 2 };
    return (
      order[mapToClinicalStatus(a.status)] - order[mapToClinicalStatus(b.status)]
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.35 }}
      className="hos-card h-full"
    >
      <h2 className="text-base font-semibold text-white mb-4">Actividad clinica</h2>

      <div className="max-h-[420px] overflow-y-auto space-y-0.5 no-scrollbar">
        {sorted.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-8">
            No hay actividad clinica registrada
          </p>
        ) : (
          sorted.map((apt) => {
            const status = mapToClinicalStatus(apt.status);
            const colors = clinicalStatusColors[status];
            const timeStr = apt.scheduled_time || apt.time || '';

            return (
              <div
                key={apt.id}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <span className={`hos-status-dot ${colors.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">
                    {apt.patient_name || apt.patient}
                  </p>
                  <p className="text-xs text-white/35 truncate">
                    {apt.provider} &middot; {apt.type}
                  </p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${colors.badge}`}>
                  {colors.label}
                </span>
                <span className="text-xs text-white/30 tabular-nums w-12 text-right">
                  {formatTime(timeStr)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
