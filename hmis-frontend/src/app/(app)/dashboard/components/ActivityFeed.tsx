'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { UserPlus, CalendarCheck, Receipt, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'patient' | 'appointment' | 'invoice' | 'prescription';
  description: string;
  time: string;
}

const iconMap = {
  patient: { icon: UserPlus, bg: 'bg-primary-50 dark:bg-primary-900/20', color: 'text-primary-500' },
  appointment: { icon: CalendarCheck, bg: 'bg-accent-50 dark:bg-accent-900/20', color: 'text-accent-600' },
  invoice: { icon: Receipt, bg: 'bg-amber-50 dark:bg-amber-900/20', color: 'text-amber-500' },
  prescription: { icon: Pill, bg: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-500' },
};

const sampleActivities: Activity[] = [
  { id: '1', type: 'patient', description: 'Nuevo paciente registrado', time: 'Hace 5 min' },
  { id: '2', type: 'appointment', description: 'Cita completada - Dr. Martinez', time: 'Hace 12 min' },
  { id: '3', type: 'invoice', description: 'Factura #1024 pagada', time: 'Hace 25 min' },
  { id: '4', type: 'prescription', description: 'Receta dispensada', time: 'Hace 40 min' },
  { id: '5', type: 'appointment', description: 'Nueva cita agendada', time: 'Hace 1 hora' },
];

export function ActivityFeed() {
  const shouldReduce = useReducedMotion();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 px-1">
        Actividad reciente
      </h3>
      <div className="space-y-1">
        {sampleActivities.map((activity, index) => {
          const { icon: Icon, bg, color } = iconMap[activity.type];

          const content = (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
                  {activity.description}
                </p>
                <p className="text-2xs text-surface-400">{activity.time}</p>
              </div>
            </div>
          );

          if (shouldReduce) return <div key={activity.id}>{content}</div>;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.3 }}
            >
              {content}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
