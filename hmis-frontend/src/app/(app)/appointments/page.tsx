'use client';

import { useState } from 'react';
import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
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
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Appointment {
  id: string;
  time: string;
  patient: string;
  provider: string;
  type: string;
  status: string;
  duration: string;
  notes?: string;
}

// ─── Mock Data ──────────────────────────────────────────

const todayAppointments: Appointment[] = [
  { id: '1', time: '08:00', patient: 'Juan Perez', provider: 'Dr. Martinez', type: 'Consulta general', status: 'completada', duration: '30 min' },
  { id: '2', time: '08:30', patient: 'Maria Rodriguez', provider: 'Dr. Martinez', type: 'Control', status: 'en_progreso', duration: '20 min' },
  { id: '3', time: '09:00', patient: 'Carlos Gomez', provider: 'Dr. Martinez', type: 'Consulta general', status: 'confirmada', duration: '30 min', notes: 'Primera vez' },
  { id: '4', time: '09:30', patient: 'Ana Gonzalez', provider: 'Dra. Lopez', type: 'Especializada', status: 'confirmada', duration: '45 min' },
  { id: '5', time: '10:00', patient: 'Pedro Sanchez', provider: 'Dr. Martinez', type: 'Procedimiento', status: 'pendiente', duration: '60 min' },
  { id: '6', time: '10:30', patient: 'Laura Diaz', provider: 'Dra. Lopez', type: 'Control', status: 'pendiente', duration: '20 min' },
  { id: '7', time: '11:00', patient: 'Roberto Hernandez', provider: 'Dr. Martinez', type: 'Consulta general', status: 'pendiente', duration: '30 min' },
  { id: '8', time: '14:00', patient: 'Carmen Reyes', provider: 'Dr. Martinez', type: 'Consulta general', status: 'cancelada', duration: '30 min' },
];

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00',
];

// ─── Page ───────────────────────────────────────────────

export default function AppointmentsPage() {
  const [viewMode, setViewMode] = useState<'agenda' | 'list'>('agenda');
  const [showNewModal, setShowNewModal] = useState(false);

  const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
    completada: { icon: CheckCircle2, color: 'text-green-500' },
    en_progreso: { icon: Clock, color: 'text-primary-500' },
    confirmada: { icon: UserCheck, color: 'text-blue-500' },
    pendiente: { icon: Clock, color: 'text-yellow-500' },
    cancelada: { icon: XCircle, color: 'text-neutral-400' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Citas</h1>
          <p className="page-subtitle">Agenda del dia - 6 de febrero, 2026</p>
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
            onClick={() => setShowNewModal(true)}
          >
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-primary-500" />
            <span className="font-semibold text-neutral-800">Jueves, 6 de Febrero 2026</span>
          </div>
          <Button variant="ghost" size="sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Total" value={8} icon={<CalendarDays className="w-5 h-5" />} iconColor="bg-primary-50 text-primary-500" />
        <KpiCard title="Confirmadas" value={5} icon={<UserCheck className="w-5 h-5" />} iconColor="bg-blue-50 text-blue-500" />
        <KpiCard title="En espera" value={1} icon={<Clock className="w-5 h-5" />} iconColor="bg-yellow-50 text-yellow-500" />
        <KpiCard title="Completadas" value={1} icon={<CheckCircle2 className="w-5 h-5" />} iconColor="bg-green-50 text-green-500" />
      </div>

      {/* Agenda View */}
      {viewMode === 'agenda' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
          {/* Time column */}
          <Card padding="none" className="hidden lg:block">
            <div className="p-3 border-b border-neutral-100">
              <p className="text-xs font-semibold text-neutral-500 uppercase">Horario</p>
            </div>
            <div className="divide-y divide-neutral-50">
              {timeSlots.map((slot) => {
                const appointment = todayAppointments.find((a) => a.time === slot);
                return (
                  <div
                    key={slot}
                    className={`px-3 py-3 text-sm ${appointment ? 'bg-primary-50/30' : ''}`}
                  >
                    <span className="font-mono text-neutral-500">{slot}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Appointments */}
          <div className="space-y-2">
            {todayAppointments.map((apt) => {
              const StatusIcon = statusConfig[apt.status]?.icon || Clock;
              const statusColor = statusConfig[apt.status]?.color || 'text-neutral-400';

              return (
                <Card key={apt.id} padding="sm" className="hover:shadow-card-hover transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4">
                    {/* Time */}
                    <div className="flex-shrink-0 text-center w-16">
                      <p className="text-lg font-bold text-neutral-800 font-mono">{apt.time}</p>
                      <p className="text-2xs text-neutral-400">{apt.duration}</p>
                    </div>

                    {/* Status icon */}
                    <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusColor}`} />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm">{apt.patient}</p>
                      <p className="text-xs text-neutral-500">
                        {apt.provider} - {apt.type}
                      </p>
                      {apt.notes && (
                        <p className="text-2xs text-neutral-400 mt-0.5">{apt.notes}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <StatusBadge status={apt.status} />

                    {/* Action */}
                    <Button variant="ghost" size="sm" className="flex-shrink-0">
                      Gestionar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="table-header px-4 py-3 text-left">Hora</th>
                  <th className="table-header px-4 py-3 text-left">Paciente</th>
                  <th className="table-header px-4 py-3 text-left">Proveedor</th>
                  <th className="table-header px-4 py-3 text-left">Tipo</th>
                  <th className="table-header px-4 py-3 text-left">Duracion</th>
                  <th className="table-header px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {todayAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono font-medium">{apt.time}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{apt.patient}</td>
                    <td className="px-4 py-3 text-neutral-600">{apt.provider}</td>
                    <td className="px-4 py-3 text-neutral-600">{apt.type}</td>
                    <td className="px-4 py-3 text-neutral-500">{apt.duration}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm">
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Appointment Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Programar Nueva Cita"
        description="Complete la informacion para agendar una cita."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowNewModal(false)}>Agendar Cita</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Paciente" placeholder="Buscar paciente..." required />
          <Select
            label="Proveedor"
            required
            options={[
              { value: 'dr-martinez', label: 'Dr. Martinez' },
              { value: 'dra-lopez', label: 'Dra. Lopez' },
            ]}
            placeholder="Seleccionar proveedor"
          />
          <Input label="Fecha" type="date" required />
          <Input label="Hora" type="time" required />
          <Select
            label="Tipo de Cita"
            required
            options={[
              { value: 'consulta', label: 'Consulta General' },
              { value: 'control', label: 'Control' },
              { value: 'especializada', label: 'Especializada' },
              { value: 'procedimiento', label: 'Procedimiento' },
              { value: 'emergencia', label: 'Emergencia' },
            ]}
            placeholder="Seleccionar tipo"
          />
          <Select
            label="Duracion"
            required
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
            <Textarea label="Notas" placeholder="Notas adicionales para la cita..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
