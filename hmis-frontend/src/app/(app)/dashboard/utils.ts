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
