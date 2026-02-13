/**
 * Dashboard utilities and helpers
 */

export const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

export const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return dateStr;
  }
};

export const isToday = (dateStr: string | undefined): boolean => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
};

export const appointmentStatusColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-600',
  confirmada: 'bg-blue-100 text-blue-600',
  en_progreso: 'bg-primary-100 text-primary-600',
  completada: 'bg-green-100 text-green-600',
  cancelada: 'bg-neutral-100 text-neutral-500',
};

export const appointmentTypeColors = [
  { color: '#0066CC' },
  { color: '#00897B' },
  { color: '#EA580C' },
  { color: '#DC2626' },
  { color: '#7C3AED' },
];

export const weeklyChartPlaceholder = [
  { dia: 'Lun', pacientes: 0 },
  { dia: 'Mar', pacientes: 0 },
  { dia: 'Mie', pacientes: 0 },
  { dia: 'Jue', pacientes: 0 },
  { dia: 'Vie', pacientes: 0 },
  { dia: 'Sab', pacientes: 0 },
  { dia: 'Dom', pacientes: 0 },
];

// ── Health OS helpers ─────────────────────────────────────

export type ClinicalStatus = 'waiting' | 'active' | 'completed';

export const clinicalStatusColors: Record<ClinicalStatus, { dot: string; badge: string; label: string }> = {
  waiting: {
    dot: 'hos-status-dot--waiting',
    badge: 'bg-amber-400/10 text-amber-400',
    label: 'En espera',
  },
  active: {
    dot: 'hos-status-dot--active',
    badge: 'bg-emerald-400/10 text-emerald-400',
    label: 'En consulta',
  },
  completed: {
    dot: 'hos-status-dot--completed',
    badge: 'bg-white/5 text-white/40',
    label: 'Finalizado',
  },
};

export function mapToClinicalStatus(status: string): ClinicalStatus {
  const s = status.toLowerCase();
  if (s === 'en_progreso' || s === 'in_progress') return 'active';
  if (s === 'completada' || s === 'completed') return 'completed';
  return 'waiting';
}

export interface HourlyDataPoint {
  hour: string;
  consultas: number;
}

export function deriveHourlyDistribution(
  appointments: Array<{ time?: string; scheduled_time?: string; created_at?: string }>
): HourlyDataPoint[] {
  const hours: Record<number, number> = {};
  for (let h = 7; h <= 20; h++) hours[h] = 0;

  for (const apt of appointments) {
    const timeStr = apt.scheduled_time || apt.time || apt.created_at;
    if (!timeStr) continue;
    try {
      const d = new Date(timeStr);
      const h = d.getHours();
      if (h >= 7 && h <= 20) hours[h]++;
    } catch {
      // skip invalid dates
    }
  }

  return Object.entries(hours).map(([h, count]) => ({
    hour: `${h}:00`,
    consultas: count,
  }));
}
