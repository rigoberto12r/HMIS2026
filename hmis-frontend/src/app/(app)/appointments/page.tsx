'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Plus, Calendar, List, Filter } from 'lucide-react';
import { useAppointments } from '@/hooks/useAppointments';
import { AppointmentStats, AppointmentList } from '@/components/appointments';

export default function AppointmentsPage() {
  // State
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const pageSize = 20;

  // Fetch appointments with React Query
  const { data, isLoading, error } = useAppointments({
    page,
    page_size: pageSize,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: statusFilter || undefined,
  });

  const statusOptions = [
    { value: '', label: 'Todos los Estados' },
    { value: 'scheduled', label: 'Programada' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'checked_in', label: 'En Espera' },
    { value: 'in_progress', label: 'En Consulta' },
    { value: 'completed', label: 'Completada' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'no_show', label: 'No Asistió' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Citas</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestiona las citas médicas del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'list' ? 'primary' : 'outline'}
            size="md"
            onClick={() => setView('list')}
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button
            variant={view === 'calendar' ? 'primary' : 'outline'}
            size="md"
            onClick={() => setView('calendar')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendario
          </Button>
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Stats */}
      <AppointmentStats dateFrom={dateFrom} dateTo={dateTo} />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <Filter className="w-4 h-4 text-neutral-400 mt-2.5 hidden lg:block" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
            <Input
              type="date"
              label="Desde"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              label="Hasta"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Error al cargar citas: {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <AppointmentList appointments={data?.items || []} loading={isLoading} />
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-500">Vista de calendario en desarrollo</p>
          <p className="text-sm text-neutral-400 mt-1">
            Próximamente: calendario interactivo con drag & drop
          </p>
        </Card>
      )}

      {/* Pagination */}
      {data && data.total > pageSize && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="px-4 py-2 text-sm text-neutral-600">
            Página {page} de {Math.ceil(data.total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / pageSize)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
