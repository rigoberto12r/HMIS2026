'use client';

import { Brain, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Appointment, ARAgingReport } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';

interface AIAssistantPanelProps {
  appointments: Appointment[];
  invoices: Invoice[];
  arReport: ARAgingReport | null;
  totalPatients: number;
}

export function AIAssistantPanel({
  appointments,
  invoices,
  arReport,
  totalPatients,
}: AIAssistantPanelProps) {
  const completedCount = appointments.filter(
    (a) => a.status === 'completada' || a.status === 'completed'
  ).length;
  const pendingCount = appointments.length - completedCount;
  const overdueItems = arReport?.items?.filter((i) => i.days_outstanding > 30) ?? [];

  const alerts: string[] = [];
  if (overdueItems.length > 0) {
    alerts.push(`${overdueItems.length} pacientes con resultados criticos pendientes de revision.`);
  }
  if (pendingCount > 3) {
    alerts.push(`Sala de espera con ${pendingCount} pacientes en cola.`);
  }
  if (appointments.length > 0) {
    alerts.push(`${completedCount} citas completadas de ${appointments.length} programadas.`);
  }

  const suggestions: string[] = [];
  if (pendingCount > 5) {
    suggestions.push('Considerar abrir consultorio adicional por alta demanda.');
  }
  if (overdueItems.length > 0) {
    suggestions.push('Revisar resultados criticos de laboratorio antes de las 11:00.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Flujo operativo normal. No se requieren acciones inmediatas.');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.35 }}
      className="hos-card h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold text-white">Panel inteligente</h2>
      </div>

      {/* Summary */}
      <p className="text-sm text-white/50 leading-relaxed mb-5">
        Hoy se esperan {totalPatients} pacientes. Ocupacion actual: {Math.min(100, Math.round((appointments.length / Math.max(totalPatients, 1)) * 100))}%.
      </p>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Alertas
            </h3>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-rose-500/[0.06] border border-rose-500/10 px-3 py-2.5"
              >
                <ChevronRight className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-rose-300/90 leading-relaxed">{alert}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Sugerencias
          </h3>
        </div>
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2.5"
            >
              <ChevronRight className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white/50 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
