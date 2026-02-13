'use client';

import { Users, Stethoscope, DollarSign, AlertTriangle, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatRD, isToday } from '../utils';
import type { Appointment, ARAgingReport } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';

interface HealthOSKPIsProps {
  totalPatients: number;
  appointments: Appointment[];
  invoices: Invoice[];
  arReport: ARAgingReport | null;
}

interface KPIConfig {
  label: string;
  icon: React.ElementType;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  tintBg: string;
  value: string;
  trend: string;
  trendValue: number;
  trendPositive: boolean;
  sparklineData: Array<{ value: number }>;
}

export function HealthOSKPIs({
  totalPatients,
  appointments,
  invoices,
  arReport,
}: HealthOSKPIsProps) {
  // Calculate today's appointments
  const todayAppointments = appointments.filter((a) => {
    const schedTime = a.scheduled_time || a.time || a.created_at;
    return schedTime && isToday(schedTime);
  });

  const activeCount = appointments.filter(
    (a) => a.status === 'en_progreso' || a.status === 'in_progress'
  ).length;

  const completedToday = todayAppointments.filter(
    (a) => a.status === 'completada' || a.status === 'completed'
  ).length;

  const ingresosDia = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
  const alertCount = arReport?.items?.length ?? 0;

  // Generate mock sparkline data (last 7 data points)
  const generateSparkline = (base: number, variance: number) => {
    return Array.from({ length: 7 }, () => ({
      value: Math.max(0, base + (Math.random() - 0.5) * variance),
    }));
  };

  const kpis: KPIConfig[] = [
    {
      label: 'PACIENTES HOY',
      icon: Users,
      borderColor: 'border-l-emerald-400',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      tintBg: 'bg-emerald-500/[0.03]',
      value: todayAppointments.length.toString(),
      trend: 'vs ayer',
      trendValue: 12,
      trendPositive: true,
      sparklineData: generateSparkline(todayAppointments.length, 5),
    },
    {
      label: 'CONSULTAS ACTIVAS',
      icon: Stethoscope,
      borderColor: 'border-l-blue-400',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      tintBg: 'bg-blue-500/[0.03]',
      value: activeCount.toString(),
      trend: 'vs ayer',
      trendValue: 5,
      trendPositive: true,
      sparklineData: generateSparkline(activeCount, 2),
    },
    {
      label: 'INGRESOS DEL DIA',
      icon: DollarSign,
      borderColor: 'border-l-amber-400',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      tintBg: 'bg-amber-500/[0.03]',
      value: formatRD(ingresosDia),
      trend: 'vs ayer',
      trendValue: 8,
      trendPositive: true,
      sparklineData: generateSparkline(ingresosDia / 1000, 500),
    },
    {
      label: 'COMPLETADAS',
      icon: Activity,
      borderColor: 'border-l-violet-400',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
      tintBg: 'bg-violet-500/[0.03]',
      value: `${completedToday}/${todayAppointments.length}`,
      trend: 'tasa de completitud',
      trendValue: todayAppointments.length > 0 ? Math.round((completedToday / todayAppointments.length) * 100) : 0,
      trendPositive: true,
      sparklineData: generateSparkline(completedToday, 3),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        const TrendIcon = kpi.trendPositive ? TrendingUp : TrendingDown;

        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className={`rounded-xl border border-white/[0.06] border-l-[3px] ${kpi.borderColor} ${kpi.tintBg} p-5 relative overflow-hidden cursor-pointer group`}
            style={{ background: `linear-gradient(135deg, rgba(var(--hos-bg-card)), rgba(var(--hos-bg-card)))` }}
          >
            {/* Sparkline background */}
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpi.sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={kpi.iconColor.replace('text-', '#')}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="relative flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-white/40 tracking-wider mb-2">
                  {kpi.label}
                </p>
                <p className="text-3xl font-bold text-white tracking-tight mb-3">{kpi.value}</p>
                <div className="flex items-center gap-1.5">
                  <TrendIcon className={`w-3.5 h-3.5 ${kpi.trendPositive ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span className={`text-xs font-semibold ${kpi.trendPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {kpi.trendValue}%
                  </span>
                  <span className="text-xs text-white/30">{kpi.trend}</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl ${kpi.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
