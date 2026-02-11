'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Search,
  X,
  User,
} from 'lucide-react';
import { useEncounters, useCreateEncounter } from '@/hooks/useEncounters';
import { usePatients, type Patient } from '@/hooks/usePatients';

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

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // New encounter modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const [newType, setNewType] = useState('');
  const [newReason, setNewReason] = useState('');

  // ─── React Query ──────────────────────────────────────

  const {
    data: encountersData,
    isLoading,
    error,
    refetch,
  } = useEncounters({
    page,
    page_size: 50,
    status: statusFilter || undefined,
  });

  const createEncounter = useCreateEncounter();

  // Patient search with debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const { data: patientResults, isFetching: searchingPatients } = usePatients(
    { query: debouncedSearch, page_size: 8 },
  );

  const patientOptions = useMemo(() => {
    if (!patientResults?.items) return [];
    return patientResults.items;
  }, [patientResults]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setNewPatientId(patient.id);
    setPatientSearch('');
    setShowPatientDropdown(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setNewPatientId('');
    setPatientSearch('');
  }, []);

  const encounters = useMemo(
    () => extractItems<Encounter>(encountersData),
    [encountersData]
  );

  // KPIs computed from fetched data
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: encounters.filter((e) => e.created_at?.startsWith(today)).length,
      inProgress: encounters.filter((e) => e.status === 'in_progress').length,
      completed: encounters.filter((e) => e.status === 'completed').length,
    };
  }, [encounters]);

  // ─── Create Encounter ─────────────────────────────────

  const handleCreateEncounter = useCallback(async () => {
    if (!newPatientId || !newType) return;
    try {
      const created = await createEncounter.mutateAsync({
        patient_id: newPatientId,
        encounter_type: newType as 'outpatient' | 'inpatient' | 'emergency' | 'telemedicine',
        reason: newReason || '',
      });
      setShowNewModal(false);
      setNewPatientId('');
      setNewType('');
      setNewReason('');
      router.push(`/emr/${created.id}`);
    } catch {
      // Error is available via createEncounter.error
    }
  }, [newPatientId, newType, newReason, router, createEncounter]);

  const handleCloseModal = useCallback(() => {
    setShowNewModal(false);
    createEncounter.reset();
    setNewPatientId('');
    setSelectedPatient(null);
    setPatientSearch('');
    setNewType('');
    setNewReason('');
  }, [createEncounter]);

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

  const errorMessage = error instanceof Error ? error.message : error ? 'Error al cargar encuentros' : null;
  const createErrorMessage = createEncounter.error instanceof Error
    ? createEncounter.error.message
    : createEncounter.error ? 'Error al crear encuentro' : null;

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
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{errorMessage}</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
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
          loading={isLoading}
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
              disabled={createEncounter.isPending || !newPatientId || !newType}
            >
              {createEncounter.isPending ? 'Creando...' : 'Iniciar Encuentro'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createErrorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{createErrorMessage}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient search selector */}
            <div ref={patientSearchRef} className="relative">
              <label className="form-label">
                Paciente<span className="text-medical-red ml-0.5">*</span>
              </label>
              {selectedPatient ? (
                <div className="flex items-center gap-3 p-2.5 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xs font-bold">
                      {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      MRN: {selectedPatient.mrn} | {selectedPatient.document_number}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar por nombre, MRN o cedula..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => { if (patientSearch.length > 0) setShowPatientDropdown(true); }}
                    leftIcon={<Search className="w-4 h-4" />}
                    rightIcon={searchingPatients ? (
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    ) : undefined}
                  />
                  {showPatientDropdown && patientSearch.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {patientOptions.length === 0 && !searchingPatients ? (
                        <div className="p-3 text-center text-sm text-neutral-400">
                          No se encontraron pacientes
                        </div>
                      ) : (
                        patientOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 text-left transition-colors"
                            onClick={() => handleSelectPatient(p)}
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-neutral-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 truncate">
                                {p.first_name} {p.last_name}
                              </p>
                              <p className="text-xs text-neutral-500">
                                MRN: {p.mrn} | {p.document_number}
                              </p>
                            </div>
                            <Badge variant="default" size="sm">
                              {p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : 'O'}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
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
