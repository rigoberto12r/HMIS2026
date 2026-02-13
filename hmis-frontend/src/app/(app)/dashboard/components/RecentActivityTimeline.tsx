'use client';

import { motion } from 'framer-motion';
import { Calendar, FileText, UserPlus, DollarSign, Pill } from 'lucide-react';
import type { Appointment } from '@/hooks/useDashboard';
import type { Invoice } from '@/hooks/useInvoices';
import { formatTime } from '../utils';

interface RecentActivityTimelineProps {
  appointments: Appointment[];
  invoices: Invoice[];
}

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'invoice' | 'patient' | 'prescription' | 'order';
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
}

export function RecentActivityTimeline({
  appointments,
  invoices,
}: RecentActivityTimelineProps) {
  const events: TimelineEvent[] = [];

  // Add recent appointments
  appointments.slice(0, 3).forEach((apt) => {
    events.push({
      id: `apt-${apt.id}`,
      type: 'appointment',
      icon: Calendar,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      title: 'Cita programada',
      description: `${apt.patient_name || apt.patient} - ${apt.type}`,
      time: formatTime(apt.scheduled_time || apt.time || apt.created_at || ''),
    });
  });

  // Add recent invoices
  invoices.slice(0, 2).forEach((inv) => {
    events.push({
      id: `inv-${inv.id}`,
      type: 'invoice',
      icon: DollarSign,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      title: 'Factura generada',
      description: `#${inv.invoice_number} - RD$ ${inv.grand_total?.toLocaleString()}`,
      time: formatTime(inv.created_at || ''),
    });
  });

  // Mock events (would come from real endpoints)
  events.push(
    {
      id: 'mock-1',
      type: 'patient',
      icon: UserPlus,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      title: 'Nuevo paciente',
      description: 'Juan Perez registrado en el sistema',
      time: '09:15',
    },
    {
      id: 'mock-2',
      type: 'prescription',
      icon: Pill,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      title: 'Receta despachada',
      description: 'Amoxicilina 500mg - Ana Martinez',
      time: '08:45',
    },
    {
      id: 'mock-3',
      type: 'order',
      icon: FileText,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      title: 'Orden de laboratorio',
      description: 'Hemograma completo - Carlos Rodriguez',
      time: '08:30',
    }
  );

  // Sort by time (most recent first) and limit to 8
  const sortedEvents = events.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="hos-card"
    >
      <h2 className="text-base font-semibold text-white mb-4">Actividad reciente</h2>
      <p className="text-xs text-white/40 mb-4">Ultimas acciones del sistema</p>

      <div className="space-y-0 max-h-[420px] overflow-y-auto no-scrollbar">
        {sortedEvents.map((event, i) => {
          const Icon = event.icon;
          const isLast = i === sortedEvents.length - 1;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65 + i * 0.04, duration: 0.3 }}
              className="relative pl-8 pb-6 last:pb-0"
            >
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[15px] top-10 w-[2px] h-full bg-white/[0.06]" />
              )}

              {/* Icon */}
              <div
                className={`absolute left-0 top-0 w-8 h-8 rounded-lg ${event.iconBg} flex items-center justify-center border border-white/[0.06]`}
              >
                <Icon className={`w-4 h-4 ${event.iconColor}`} />
              </div>

              {/* Content */}
              <div className="hover:bg-white/[0.02] rounded-lg p-2 -ml-2 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-medium text-white/90">{event.title}</h3>
                  <span className="text-xs text-white/30 tabular-nums ml-2">{event.time}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{event.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
