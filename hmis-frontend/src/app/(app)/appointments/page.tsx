'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/input';
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Clock,
  UserCheck,
  XCircle,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  AlertCircle,
  Play,
  Ban,
  Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  status: string;
  notes: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  created_at: string;
}

interface AppointmentsResponse {
  items: Appointment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface NewAppointmentForm {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  notes: string;
}

// ─── Status Configuration ───────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  checked_in: 'En Espera',
  in_progress: 'En Consulta',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No Asistio',
};

const STATUS_BADGE_CONFIG: Record<string, { variant: 'warning' | 'info' | 'primary' | 'success' | 'default' | 'danger'; icon: typeof Clock }> = {
  scheduled: { variant: 'warning', icon: Clock },
  confirmed: { variant: 'info', icon: UserCheck },
  checked_in: { variant: 'primary', icon: Clock },
  in_progress: { variant: 'primary', icon: Play },
  completed: { variant: 'success', icon: CheckCircle2 },
  cancelled: { variant: 'default', icon: XCircle },
  no_show: { variant: 'danger', icon: Ban },
};

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consulta: 'Consulta General',
  emergencia: 'Emergencia',
  control: 'Control',
  procedimiento: 'Procedimiento',
  laboratorio: 'Laboratorio',
  imagen: 'Imagen',
};

// ─── Status Transitions ─────────────────────────────────
// scheduled → confirmed → checked_in → in_progress → completed
// scheduled → cancelled
// scheduled → no_show

const STATUS_TRANSITIONS: Record<string, { next: string; label: string; variant: 'primary' | 'success' | 'danger' | 'outline' }[]> = {
  scheduled: [
    { next: 'confirmed', label: 'Confirmar', variant: 'primary' },
    { next: 'cancelled', label: 'Cancelar', variant: 'danger' },
    { next: 'no_show', label: 'No Asistio', variant: 'outline' },
  ],
  confirmed: [
    { next: 'checked_in', label: 'Check-in', variant: 'primary' },
    { next: 'cancelled', label: 'Cancelar', variant: 'danger' },
  ],
  checked_in: [
    { next: 'in_progress', label: 'Iniciar', variant: 'primary' },
  ],
  in_progress: [
    { next: 'completed', label: 'Completar', variant: 'success' },
  ],
};

// ─── Helpers ────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const formatted = date.toLocaleDateString('es-DO', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getTodayStr(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function calcEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function calcDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return '--';
  return `${diff} min`;
}

const EMPTY_FORM: NewAppointmentForm = {
  patient_id: '',
  doctor_id: '',
  appointment_date: '',
  start_time: '',
  end_time: '',
  appointment_type: '',
  notes: '',
};

// ─── Time Slots for Agenda View ─────────────────────────

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00',
];

// ─── Page ───────────────────────────────────────────────

export default function AppointmentsPage() {
  const [viewMode, setViewMode] = useState<'agenda' | 'list'>('agenda');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Filters
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // New appointment form
  const [form, setForm] = useState<NewAppointmentForm>(EMPTY_FORM);
  const [formDuration, setFormDuration] = useState('30');
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Fetch Appointments ─────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        page_size: 50,
        date_from: selectedDate,
        date_to: selectedDate,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }
      const data = await api.get<AppointmentsResponse>('/appointments', params);
      setAppointments(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar las citas';
      setError(message);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedDate, statusFilter]);

  // ─── KPI Calculations ───────────────────────────────────

  const kpiTotal = total;
  const kpiConfirmed = appointments.filter((a) => a.status === 'confirmed').length;
  const kpiWaiting = appointments.filter((a) => a.status === 'checked_in').length;
  const kpiCompleted = appointments.filter((a) => a.status === 'completed').length;

  // ─── Date Navigation ────────────────────────────────────

  const goToPreviousDay = () => setSelectedDate((d) => addDays(d, -1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(getTodayStr());

  // ─── Create Appointment ─────────────────────────────────

  const handleCreateAppointment = async () => {
    setFormError(null);

    if (!form.patient_id || !form.doctor_id || !form.appointment_date || !form.start_time || !form.appointment_type) {
      setFormError('Por favor complete todos los campos obligatorios.');
      return;
    }

    const endTime = form.end_time || calcEndTime(form.start_time, parseInt(formDuration, 10));

    setCreateLoading(true);
    try {
      await api.post('/appointments', {
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_date: form.appointment_date,
        start_time: form.start_time,
        end_time: endTime,
        appointment_type: form.appointment_type,
        notes: form.notes || null,
      });
      setShowNewModal(false);
      setForm(EMPTY_FORM);
      setFormDuration('30');
      setFormError(null);
      await fetchAppointments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la cita';
      setFormError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Status Transition ──────────────────────────────────

  const handleStatusTransition = async (appointmentId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/appointments/${appointmentId}/status`, {
        status: newStatus,
      });
      setShowActionsModal(false);
      setSelectedAppointment(null);
      await fetchAppointments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar el estado';
      alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Manage Appointment ─────────────────────────────────

  const openManageModal = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowActionsModal(true);
  };

  // ─── Form Update Helper ─────────────────────────────────

  const updateForm = (field: keyof NewAppointmentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Sort appointments by time ──────────────────────────

  const sortedAppointments = [...appointments].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  // ─── Render Status Badge ────────────────────────────────

  const renderStatusBadge = (status: string) => {
    const config = STATUS_BADGE_CONFIG[status];
    const label = STATUS_LABELS[status] || status;
    const variant = config?.variant || 'default';
    return (
      <Badge variant={variant} dot size="md">
        {label}
      </Badge>
    );
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Citas</h1>
          <p className="page-subtitle">Agenda del dia - {formatDateDisplay(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('agenda')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'agenda' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
              aria-label="Vista agenda"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
              aria-label="Vista lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setForm({ ...EMPTY_FORM, appointment_date: selectedDate });
              setFormError(null);
              setShowNewModal(true);
            }}
          >
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Date navigation + Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary-500" />
              <span className="font-semibold text-neutral-800">
                {formatDateDisplay(selectedDate)}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={goToNextDay}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {selectedDate !== getTodayStr() && (
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoy
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto text-sm"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'scheduled', label: 'Programada' },
                { value: 'confirmed', label: 'Confirmada' },
                { value: 'checked_in', label: 'En Espera' },
                { value: 'in_progress', label: 'En Consulta' },
                { value: 'completed', label: 'Completada' },
                { value: 'cancelled', label: 'Cancelada' },
                { value: 'no_show', label: 'No Asistio' },
              ]}
              placeholder="Todos los estados"
              className="w-auto text-sm"
            />
            {statusFilter && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          title="Total citas hoy"
          value={loading ? '...' : kpiTotal}
          icon={<CalendarDays className="w-5 h-5" />}
          iconColor="bg-primary-50 text-primary-500"
        />
        <KpiCard
          title="Confirmadas"
          value={loading ? '...' : kpiConfirmed}
          icon={<UserCheck className="w-5 h-5" />}
          iconColor="bg-blue-50 text-blue-500"
        />
        <KpiCard
          title="En espera"
          value={loading ? '...' : kpiWaiting}
          icon={<Clock className="w-5 h-5" />}
          iconColor="bg-yellow-50 text-yellow-500"
        />
        <KpiCard
          title="Completadas"
          value={loading ? '...' : kpiCompleted}
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconColor="bg-green-50 text-green-500"
        />
      </div>

      {/* Error State */}
      {error && (
        <Card padding="md">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error al cargar citas</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAppointments} className="ml-auto">
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Cargando citas...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && sortedAppointments.length === 0 && (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <CalendarDays className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium text-neutral-600">No hay citas</p>
            <p className="text-sm mt-1">
              No se encontraron citas para {formatDateDisplay(selectedDate)}
              {statusFilter && ` con estado "${STATUS_LABELS[statusFilter] || statusFilter}"`}.
            </p>
            <Button
              size="sm"
              className="mt-4"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setForm({ ...EMPTY_FORM, appointment_date: selectedDate });
                setFormError(null);
                setShowNewModal(true);
              }}
            >
              Programar Cita
            </Button>
          </div>
        </Card>
      )}

      {/* Agenda View */}
      {!loading && !error && sortedAppointments.length > 0 && viewMode === 'agenda' && (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
          {/* Time column */}
          <Card padding="none" className="hidden lg:block">
            <div className="p-3 border-b border-neutral-100">
              <p className="text-xs font-semibold text-neutral-500 uppercase">Horario</p>
            </div>
            <div className="divide-y divide-neutral-50">
              {TIME_SLOTS.map((slot) => {
                const hasAppointment = sortedAppointments.some((a) => a.start_time === slot);
                return (
                  <div
                    key={slot}
                    className={`px-3 py-3 text-sm ${hasAppointment ? 'bg-primary-50/30' : ''}`}
                  >
                    <span className="font-mono text-neutral-500">{slot}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Appointments */}
          <div className="space-y-2">
            {sortedAppointments.map((apt) => {
              const config = STATUS_BADGE_CONFIG[apt.status];
              const StatusIcon = config?.icon || Clock;
              const iconColorMap: Record<string, string> = {
                scheduled: 'text-yellow-500',
                confirmed: 'text-blue-500',
                checked_in: 'text-primary-500',
                in_progress: 'text-primary-600',
                completed: 'text-green-500',
                cancelled: 'text-neutral-400',
                no_show: 'text-red-500',
              };
              const statusColor = iconColorMap[apt.status] || 'text-neutral-400';
              const duration = calcDuration(apt.start_time, apt.end_time);
              const typeLabel = APPOINTMENT_TYPE_LABELS[apt.appointment_type] || apt.appointment_type;

              return (
                <Card key={apt.id} padding="sm" className="hover:shadow-card-hover transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4">
                    {/* Time */}
                    <div className="flex-shrink-0 text-center w-16">
                      <p className="text-lg font-bold text-neutral-800 font-mono">{apt.start_time}</p>
                      <p className="text-2xs text-neutral-400">{duration}</p>
                    </div>

                    {/* Status icon */}
                    <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusColor}`} />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm">
                        {apt.patient_name || `Paciente ${apt.patient_id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {apt.doctor_name || `Doctor ${apt.doctor_id.slice(0, 8)}`} - {typeLabel}
                      </p>
                      {apt.notes && (
                        <p className="text-2xs text-neutral-400 mt-0.5">{apt.notes}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    {renderStatusBadge(apt.status)}

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(STATUS_TRANSITIONS[apt.status] || []).slice(0, 1).map((transition) => (
                        <Button
                          key={transition.next}
                          variant={transition.variant}
                          size="sm"
                          disabled={actionLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusTransition(apt.id, transition.next);
                          }}
                        >
                          {transition.label}
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openManageModal(apt);
                        }}
                      >
                        Gestionar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {!loading && !error && sortedAppointments.length > 0 && viewMode === 'list' && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="table-header px-4 py-3 text-left">Hora</th>
                  <th className="table-header px-4 py-3 text-left">Paciente</th>
                  <th className="table-header px-4 py-3 text-left">Doctor</th>
                  <th className="table-header px-4 py-3 text-left">Tipo</th>
                  <th className="table-header px-4 py-3 text-left">Duracion</th>
                  <th className="table-header px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedAppointments.map((apt) => {
                  const duration = calcDuration(apt.start_time, apt.end_time);
                  const typeLabel = APPOINTMENT_TYPE_LABELS[apt.appointment_type] || apt.appointment_type;

                  return (
                    <tr key={apt.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-mono font-medium">
                        {apt.start_time} - {apt.end_time}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {apt.patient_name || `Paciente ${apt.patient_id.slice(0, 8)}`}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {apt.doctor_name || `Doctor ${apt.doctor_id.slice(0, 8)}`}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{typeLabel}</td>
                      <td className="px-4 py-3 text-neutral-500">{duration}</td>
                      <td className="px-4 py-3">{renderStatusBadge(apt.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(STATUS_TRANSITIONS[apt.status] || []).slice(0, 1).map((transition) => (
                            <Button
                              key={transition.next}
                              variant={transition.variant}
                              size="sm"
                              disabled={actionLoading}
                              onClick={() => handleStatusTransition(apt.id, transition.next)}
                            >
                              {transition.label}
                            </Button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManageModal(apt)}
                          >
                            Gestionar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
              <p className="text-sm text-neutral-500">
                Pagina {page} de {totalPages} ({total} citas)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─── New Appointment Modal ──────────────────────────── */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setForm(EMPTY_FORM);
          setFormDuration('30');
          setFormError(null);
        }}
        title="Programar Nueva Cita"
        description="Complete la informacion para agendar una cita."
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewModal(false);
                setForm(EMPTY_FORM);
                setFormDuration('30');
                setFormError(null);
              }}
              disabled={createLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAppointment}
              isLoading={createLoading}
            >
              Agendar Cita
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="ID Paciente"
              placeholder="ID del paciente"
              required
              value={form.patient_id}
              onChange={(e) => updateForm('patient_id', e.target.value)}
            />
            <Input
              label="ID Doctor"
              placeholder="ID del doctor"
              required
              value={form.doctor_id}
              onChange={(e) => updateForm('doctor_id', e.target.value)}
            />
            <Input
              label="Fecha"
              type="date"
              required
              value={form.appointment_date}
              onChange={(e) => updateForm('appointment_date', e.target.value)}
            />
            <Input
              label="Hora de Inicio"
              type="time"
              required
              value={form.start_time}
              onChange={(e) => updateForm('start_time', e.target.value)}
            />
            <Select
              label="Tipo de Cita"
              required
              value={form.appointment_type}
              onChange={(e) => updateForm('appointment_type', e.target.value)}
              options={[
                { value: 'consulta', label: 'Consulta General' },
                { value: 'control', label: 'Control' },
                { value: 'emergencia', label: 'Emergencia' },
                { value: 'procedimiento', label: 'Procedimiento' },
                { value: 'laboratorio', label: 'Laboratorio' },
                { value: 'imagen', label: 'Imagen' },
              ]}
              placeholder="Seleccionar tipo"
            />
            <Select
              label="Duracion"
              required
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              options={[
                { value: '15', label: '15 minutos' },
                { value: '20', label: '20 minutos' },
                { value: '30', label: '30 minutos' },
                { value: '45', label: '45 minutos' },
                { value: '60', label: '60 minutos' },
              ]}
              placeholder="Seleccionar duracion"
            />
            <div className="md:col-span-2">
              <Textarea
                label="Notas"
                placeholder="Notas adicionales para la cita..."
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Manage Appointment Modal ───────────────────────── */}
      <Modal
        isOpen={showActionsModal}
        onClose={() => {
          setShowActionsModal(false);
          setSelectedAppointment(null);
        }}
        title="Gestionar Cita"
        description={
          selectedAppointment
            ? `${selectedAppointment.patient_name || 'Paciente'} - ${formatDateDisplay(selectedAppointment.appointment_date)}`
            : ''
        }
        size="md"
      >
        {selectedAppointment && (
          <div className="space-y-4">
            {/* Appointment details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-neutral-500">Paciente</p>
                <p className="font-medium text-neutral-900">
                  {selectedAppointment.patient_name || `ID: ${selectedAppointment.patient_id.slice(0, 8)}`}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Doctor</p>
                <p className="font-medium text-neutral-900">
                  {selectedAppointment.doctor_name || `ID: ${selectedAppointment.doctor_id.slice(0, 8)}`}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Horario</p>
                <p className="font-medium text-neutral-900 font-mono">
                  {selectedAppointment.start_time} - {selectedAppointment.end_time}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Tipo</p>
                <p className="font-medium text-neutral-900">
                  {APPOINTMENT_TYPE_LABELS[selectedAppointment.appointment_type] || selectedAppointment.appointment_type}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Estado Actual</p>
                <div className="mt-1">{renderStatusBadge(selectedAppointment.status)}</div>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <p className="text-neutral-500">Notas</p>
                  <p className="font-medium text-neutral-900">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>

            {/* Status transition actions */}
            {STATUS_TRANSITIONS[selectedAppointment.status] && (
              <div className="border-t border-neutral-100 pt-4">
                <p className="text-sm font-medium text-neutral-700 mb-3">Acciones disponibles</p>
                <div className="flex flex-wrap gap-2">
                  {(STATUS_TRANSITIONS[selectedAppointment.status] || []).map((transition) => (
                    <Button
                      key={transition.next}
                      variant={transition.variant}
                      size="sm"
                      isLoading={actionLoading}
                      onClick={() => handleStatusTransition(selectedAppointment.id, transition.next)}
                    >
                      {transition.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Terminal states */}
            {!STATUS_TRANSITIONS[selectedAppointment.status] && (
              <div className="border-t border-neutral-100 pt-4">
                <p className="text-sm text-neutral-500">
                  Esta cita se encuentra en estado final y no permite mas transiciones.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
