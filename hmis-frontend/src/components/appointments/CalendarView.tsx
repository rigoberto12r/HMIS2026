'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Appointment } from '@/hooks/useAppointments';

interface CalendarViewProps {
  appointments: Appointment[];
  loading?: boolean;
  onSelectDate?: (date: Date) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
}

type ViewMode = 'month' | 'week';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  arrived: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  no_show: 'bg-orange-100 text-orange-700 border-orange-200',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function CalendarView({ appointments, loading, onSelectDate, onSelectAppointment }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const date = new Date(appt.appointment_datetime);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    // Sort each day's appointments by time
    map.forEach((appts) => {
      appts.sort((a, b) => new Date(a.appointment_datetime).getTime() - new Date(b.appointment_datetime).getTime());
    });
    return map;
  }, [appointments]);

  const getAppointmentsForDate = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return appointmentsByDate.get(key) || [];
  };

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid for month view
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }
  // Next month fill
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
    });
  }

  // Week view: get days of current week
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const navigateWeek = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta * 7);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Cargando calendario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-neutral-900 min-w-[200px] text-center">
            {viewMode === 'month'
              ? `${MONTH_NAMES[month]} ${year}`
              : `Semana del ${weekDays[0].toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
          </h2>
          <Button variant="outline" size="sm" onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>
          <div className="flex border border-neutral-200 rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${viewMode === 'month' ? 'bg-primary-500 text-white' : 'bg-white text-neutral-700'}`}
              onClick={() => setViewMode('month')}
            >
              Mes
            </button>
            <button
              className={`px-3 py-1 text-sm ${viewMode === 'week' ? 'bg-primary-500 text-white' : 'bg-white text-neutral-700'}`}
              onClick={() => setViewMode('week')}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-neutral-50">
            {DAY_NAMES.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-medium text-neutral-600 border-b border-neutral-200">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, idx) => {
              const dayAppts = getAppointmentsForDate(date);
              const isToday = isSameDay(date, today);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-1 border-b border-r border-neutral-100 cursor-pointer hover:bg-neutral-50 transition-colors ${
                    !isCurrentMonth ? 'bg-neutral-50/50' : ''
                  }`}
                  onClick={() => onSelectDate?.(date)}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-primary-500 text-white' : isCurrentMonth ? 'text-neutral-900' : 'text-neutral-400'
                  }`}>
                    {date.getDate()}
                  </div>

                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((appt) => (
                      <button
                        key={appt.id}
                        onClick={(e) => { e.stopPropagation(); onSelectAppointment?.(appt); }}
                        className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate border ${STATUS_COLORS[appt.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}
                        title={`${formatTime(appt.appointment_datetime)} - ${appt.patient_name || 'Paciente'}`}
                      >
                        {formatTime(appt.appointment_datetime)} {appt.patient_name?.split(' ')[0] || ''}
                      </button>
                    ))}
                    {dayAppts.length > 3 && (
                      <div className="text-[10px] text-neutral-500 px-1">
                        +{dayAppts.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-neutral-50">
            {weekDays.map((date, idx) => {
              const isToday = isSameDay(date, today);
              return (
                <div key={idx} className="py-2 text-center border-b border-neutral-200">
                  <div className="text-xs text-neutral-500">{DAY_NAMES[date.getDay()]}</div>
                  <div className={`text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                    isToday ? 'bg-primary-500 text-white' : 'text-neutral-900'
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map((date, idx) => {
              const dayAppts = getAppointmentsForDate(date);
              return (
                <div
                  key={idx}
                  className="p-2 border-r border-neutral-100 space-y-1 cursor-pointer hover:bg-neutral-50/50"
                  onClick={() => onSelectDate?.(date)}
                >
                  {dayAppts.map((appt) => (
                    <button
                      key={appt.id}
                      onClick={(e) => { e.stopPropagation(); onSelectAppointment?.(appt); }}
                      className={`w-full text-left p-2 rounded-lg border text-xs ${STATUS_COLORS[appt.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {formatTime(appt.appointment_datetime)}
                      </div>
                      <div className="mt-0.5 truncate">{appt.patient_name || 'Paciente'}</div>
                      {appt.appointment_type && (
                        <div className="mt-0.5 text-[10px] opacity-75 capitalize">{appt.appointment_type}</div>
                      )}
                    </button>
                  ))}
                  {dayAppts.length === 0 && (
                    <div className="text-[10px] text-neutral-300 text-center pt-4">Sin citas</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { status: 'scheduled', label: 'Programada' },
          { status: 'confirmed', label: 'Confirmada' },
          { status: 'in_progress', label: 'En Curso' },
          { status: 'completed', label: 'Completada' },
          { status: 'cancelled', label: 'Cancelada' },
          { status: 'no_show', label: 'No Show' },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded border ${STATUS_COLORS[status]}`} />
            <span className="text-neutral-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
