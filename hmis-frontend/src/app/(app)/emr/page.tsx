'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/input';
import { Plus, AlertTriangle } from 'lucide-react';
import { useEncounters } from '@/hooks/useEncounters';
import { NewEncounterModal } from './components/NewEncounterModal';
import { EMRStats } from './components/EMRStats';

// ─── Types ──────────────────────────────────────────────

interface Encounter {
  id: string;
  patient_id: string;
  provider_id: string;
  encounter_type: string;
  status: string;
  chief_complaint: string | null;
  start_datetime: string;
  created_at?: string;
}

// ─── Config ─────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<string, 'primary' | 'success' | 'default'> = {
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'default',
};

const typeConfig: Record<string, { label: string; variant: 'primary' | 'danger' | 'secondary' }> = {
  ambulatory: { label: 'Ambulatorio', variant: 'primary' },
  emergency: { label: 'Emergencia', variant: 'danger' },
  inpatient: { label: 'Hospitalizacion', variant: 'secondary' },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) return (data as { items: T[] }).items;
  return [];
}

// ─── Page ───────────────────────────────────────────────

export default function EMRPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: encountersData, isLoading, error, refetch } = useEncounters({
    page,
    page_size: 50,
    status: statusFilter || undefined,
  });

  const encounters = useMemo(() => extractItems<Encounter>(encountersData), [encountersData]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: encounters.filter((e) => e.start_datetime?.startsWith(today)).length,
      inProgress: encounters.filter((e) => e.status === 'in_progress').length,
      completed: encounters.filter((e) => e.status === 'completed').length,
    };
  }, [encounters]);

  const columns: Column<Encounter>[] = [
    {
      key: 'start_datetime', header: 'Fecha', sortable: true, width: '160px',
      render: (row) => <span className="font-mono text-xs">{formatDate(row.start_datetime)}</span>,
    },
    {
      key: 'patient_id', header: 'Paciente', sortable: true,
      render: (row) => <span className="font-mono text-xs text-neutral-600">{row.patient_id?.slice(0, 8)}...</span>,
    },
    {
      key: 'encounter_type', header: 'Tipo',
      render: (row) => {
        const config = typeConfig[row.encounter_type];
        return config
          ? <Badge variant={config.variant} size="sm">{config.label}</Badge>
          : <span className="text-neutral-600">{row.encounter_type}</span>;
      },
    },
    {
      key: 'chief_complaint', header: 'Motivo de Consulta',
      render: (row) => <span className="text-neutral-600 text-sm truncate max-w-xs block">{row.chief_complaint || '---'}</span>,
    },
    {
      key: 'status', header: 'Estado', width: '140px',
      render: (row) => (
        <Badge variant={statusVariants[row.status] || 'default'} dot size="md">
          {statusLabels[row.status] || row.status}
        </Badge>
      ),
    },
  ];

  const errorMessage = error instanceof Error ? error.message : error ? 'Error al cargar encuentros' : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Historia Clinica Electronica</h1>
          <p className="page-subtitle">Encuentros clinicos y documentacion medica</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
          Nuevo Encuentro
        </Button>
      </div>

      <EMRStats today={kpis.today} inProgress={kpis.inProgress} completed={kpis.completed} />

      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <Select
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'in_progress', label: 'En Progreso' },
            { value: 'completed', label: 'Completado' },
            { value: 'cancelled', label: 'Cancelado' },
          ]}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-52"
        />
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{errorMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Reintentar</Button>
        </div>
      )}

      <Card padding="none">
        <DataTable
          columns={columns}
          data={encounters}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar por paciente, proveedor o motivo..."
          emptyMessage="No se encontraron encuentros clinicos."
          loading={isLoading}
          onRowClick={(row) => router.push(`/emr/${row.id}`)}
          className="p-4"
        />
      </Card>

      <NewEncounterModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  );
}
