'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/input';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Encounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_type: string;
  status: string;
  reason: string | null;
  disposition: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  created_at: string;
  completed_at: string | null;
}

interface EncountersResponse {
  items: Encounter[];
  total: number;
}

// ─── Status & Type Config ───────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as { items: T[] }).items;
  }
  return [];
}

// ─── Page ───────────────────────────────────────────────

export default function EMRPage() {
  const router = useRouter();

  // Data state
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // KPIs
  const [kpis, setKpis] = useState({ today: 0, inProgress: 0, completed: 0 });

  // New encounter modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newType, setNewType] = useState('');
  const [newReason, setNewReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        page_size: 50,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }

      const data = await api.get<EncountersResponse>('/emr/encounters', params);
      const items = extractItems<Encounter>(data);
      setEncounters(items);

      // Compute KPIs from fetched data
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = items.filter(
        (e) => e.created_at && e.created_at.startsWith(today)
      ).length;
      const inProgressCount = items.filter(
        (e) => e.status === 'in_progress'
      ).length;
      const completedCount = items.filter(
        (e) => e.status === 'completed'
      ).length;
      setKpis({
        today: todayCount,
        inProgress: inProgressCount,
        completed: completedCount,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar encuentros'
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchEncounters();
  }, [fetchEncounters]);

  // ─── Create Encounter ─────────────────────────────────

  const handleCreateEncounter = useCallback(async () => {
    if (!newPatientId || !newType) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.post<Encounter>('/emr/encounters', {
        patient_id: newPatientId,
        encounter_type: newType,
        reason: newReason || null,
      });
      setShowNewModal(false);
      setNewPatientId('');
      setNewType('');
      setNewReason('');
      router.push(`/emr/${created.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Error al crear encuentro'
      );
    } finally {
      setCreating(false);
    }
  }, [newPatientId, newType, newReason, router]);

  const handleCloseModal = useCallback(() => {
    setShowNewModal(false);
    setCreateError(null);
    setNewPatientId('');
    setNewType('');
    setNewReason('');
  }, []);

  // ─── Table Columns ──────────────────────────────────────

  const columns: Column<Encounter>[] = [
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      width: '160px',
      render: (row) => (
        <span className="font-mono text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-neutral-900">
          {row.patient_name || '---'}
        </span>
      ),
    },
    {
      key: 'doctor_name',
      header: 'Proveedor',
      sortable: true,
      render: (row) => (
        <span className="text-neutral-600">{row.doctor_name || '---'}</span>
      ),
    },
    {
      key: 'encounter_type',
      header: 'Tipo',
      render: (row) => {
        const config = typeConfig[row.encounter_type];
        return config ? (
          <Badge variant={config.variant} size="sm">
            {config.label}
          </Badge>
        ) : (
          <span className="text-neutral-600">{row.encounter_type}</span>
        );
      },
    },
    {
      key: 'reason',
      header: 'Motivo de Consulta',
      render: (row) => (
        <span className="text-neutral-600 text-sm truncate max-w-xs block">
          {row.reason || '---'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '140px',
      render: (row) => {
        const variant = statusVariants[row.status] || 'default';
        const label = statusLabels[row.status] || row.status;
        return (
          <Badge variant={variant} dot size="md">
            {label}
          </Badge>
        );
      },
    },
  ];

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Historia Clinica Electronica</h1>
          <p className="page-subtitle">
            Encuentros clinicos y documentacion medica
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowNewModal(true)}
        >
          Nuevo Encuentro
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Encuentros Hoy',
            value: String(kpis.today),
            icon: FileText,
            color: 'text-primary-600 bg-primary-50',
          },
          {
            label: 'En Progreso',
            value: String(kpis.inProgress),
            icon: Clock,
            color: 'text-yellow-600 bg-yellow-50',
          },
          {
            label: 'Completados',
            value: String(kpis.completed),
            icon: CheckCircle2,
            color: 'text-green-600 bg-green-50',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-lg border border-neutral-200 p-3 flex items-center gap-3"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-neutral-900">{value}</p>
              <p className="text-2xs text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

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
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-52"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchEncounters}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Encounters Table */}
      <Card padding="none">
        <DataTable
          columns={columns}
          data={encounters}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar por paciente, proveedor o motivo..."
          emptyMessage="No se encontraron encuentros clinicos."
          loading={loading}
          onRowClick={(row) => router.push(`/emr/${row.id}`)}
          className="p-4"
        />
      </Card>

      {/* New Encounter Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={handleCloseModal}
        title="Iniciar Nuevo Encuentro Clinico"
        description="Ingrese los datos para iniciar un nuevo encuentro."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEncounter}
              disabled={creating || !newPatientId || !newType}
            >
              {creating ? 'Creando...' : 'Iniciar Encuentro'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{createError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="ID del Paciente"
              placeholder="Ingrese el ID del paciente"
              required
              value={newPatientId}
              onChange={(e) => setNewPatientId(e.target.value)}
            />
            <Select
              label="Tipo de Encuentro"
              required
              options={[
                { value: 'ambulatory', label: 'Ambulatorio' },
                { value: 'emergency', label: 'Emergencia' },
                { value: 'inpatient', label: 'Hospitalizacion' },
              ]}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Seleccionar tipo"
            />
            <div className="md:col-span-2">
              <Textarea
                label="Motivo de Consulta"
                placeholder="Describa el motivo principal de la consulta..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
