'use client';

import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import type { Appointment, ARAgingReport } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';

interface AlertsPanelProps {
  appointments: Appointment[];
  invoices: Invoice[];
  arReport: ARAgingReport | null;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  icon: React.ElementType;
  title: string;
  description: string;
  time?: string;
}

export function AlertsPanel({ appointments, invoices, arReport }: AlertsPanelProps) {
  const alerts: Alert[] = [];

  // Critical lab results (mock - would come from real endpoint)
  alerts.push({
    id: '1',
    type: 'critical',
    icon: AlertCircle,
    title: '2 Resultados criticos',
    description: 'Hemoglobina baja en paciente Maria Gomez (6.2 g/dL)',
    time: 'Hace 15 min',
  });

  // Pending confirmations
  const pendingConfirm = appointments.filter((a) => a.status === 'pendiente').length;
  if (pendingConfirm > 0) {
    alerts.push({
      id: '2',
      type: 'warning',
      icon: Clock,
      title: `${pendingConfirm} Citas por confirmar`,
      description: `Pacientes esperan confirmacion para hoy`,
      time: 'Hoy',
    });
  }

  // Low inventory (mock)
  alerts.push({
    id: '3',
    type: 'warning',
    icon: Package,
    title: 'Inventario bajo',
    description: '5 medicamentos por debajo del minimo',
    time: 'Hoy',
  });

  // Overdue payments
  const overdueCount = arReport?.items?.filter((i) => i.days_outstanding > 30).length ?? 0;
  if (overdueCount > 0) {
    alerts.push({
      id: '4',
      type: 'info',
      icon: AlertTriangle,
      title: `${overdueCount} Facturas vencidas`,
      description: 'Cuentas por cobrar > 30 dias',
      time: 'Esta semana',
    });
  }

  // All good fallback
  if (alerts.length === 0) {
    alerts.push({
      id: 'ok',
      type: 'info',
      icon: CheckCircle,
      title: 'Todo bajo control',
      description: 'No hay alertas pendientes en este momento',
    });
  }

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return {
          border: 'border-rose-500/20',
          bg: 'bg-rose-500/[0.08]',
          iconBg: 'bg-rose-500/10',
          iconColor: 'text-rose-400',
          titleColor: 'text-rose-300',
        };
      case 'warning':
        return {
          border: 'border-amber-500/20',
          bg: 'bg-amber-500/[0.08]',
          iconBg: 'bg-amber-500/10',
          iconColor: 'text-amber-400',
          titleColor: 'text-amber-300',
        };
      case 'info':
        return {
          border: 'border-blue-500/20',
          bg: 'bg-blue-500/[0.08]',
          iconBg: 'bg-blue-500/10',
          iconColor: 'text-blue-400',
          titleColor: 'text-blue-300',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
      className="hos-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Alertas del sistema</h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 font-medium">
          {alerts.filter((a) => a.type === 'critical').length} criticas
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          const styles = getAlertStyles(alert.type);

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.05, duration: 0.3 }}
              className={`rounded-xl border ${styles.border} ${styles.bg} p-4 hover:bg-opacity-90 transition-all cursor-pointer group`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${styles.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${styles.titleColor} mb-1`}>
                    {alert.title}
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {alert.description}
                  </p>
                  {alert.time && (
                    <p className="text-xs text-white/30 mt-1.5">{alert.time}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
