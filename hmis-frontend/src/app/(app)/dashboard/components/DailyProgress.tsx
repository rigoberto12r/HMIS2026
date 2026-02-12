'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock } from 'lucide-react';

interface DailyProgressProps {
  completed: number;
  total: number;
}

export function DailyProgress({ completed, total }: DailyProgressProps) {
  const shouldReduce = useReducedMotion();
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = percentage >= 100;

  const getColor = () => {
    if (percentage >= 80) return 'from-accent-400 to-accent-500';
    if (percentage >= 50) return 'from-amber-400 to-amber-500';
    return 'from-primary-400 to-primary-500';
  };

  const getTextColor = () => {
    if (percentage >= 80) return 'text-accent-600 dark:text-accent-400';
    if (percentage >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-primary-600 dark:text-primary-400';
  };

  return (
    <div className="bg-white dark:bg-surface-100 rounded-xl border border-surface-200 dark:border-surface-700 p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-accent-500" />
          ) : (
            <Clock className="w-4 h-4 text-surface-400" />
          )}
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Progreso del dia
          </span>
        </div>
        <span className={cn('text-sm font-bold', getTextColor())}>
          {completed} de {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 bg-surface-100 dark:bg-surface-200 rounded-full overflow-hidden">
        {shouldReduce ? (
          <div
            className={cn('h-full rounded-full bg-gradient-to-r', getColor())}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        ) : (
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', getColor())}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-surface-400">
        {isComplete
          ? 'Todas las citas del dia completadas'
          : `${total - completed} citas restantes hoy`}
      </p>
    </div>
  );
}
