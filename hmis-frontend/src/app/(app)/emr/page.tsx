'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/input';
import {
  Plus,
  FileText,
  Stethoscope,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Encounter {
  id: string;
  patient: string;
  provider: string;
  type: string;
  status: string;
  date: string;
  complaint: string;
  diagnosis?: string;
}

// ─── Mock Data ──────────────────────────────────────────

const encounters: Encounter[] = [
  {
    id: 'enc-001',
    patient: 'Juan Perez',
    provider: 'Dr. Martinez',
    type: 'ambulatorio',
    status: 'completada',
    date: '06/02/2026 08:00',
    complaint: 'Dolor de cabeza persistente',
    diagnosis: 'Cefalea tensional (G44.2)',
  },
  {
    id: 'enc-002',
    patient: 'Maria Rodriguez',
    provider: 'Dr. Martinez',
    type: 'ambulatorio',
    status: 'en_progreso',
    date: '06/02/2026 08:30',
    complaint: 'Control de hipertension',
  },
  {
    id: 'enc-003',
    patient: 'Carlos Gomez',
    provider: 'Dra. Lopez',
    type: 'emergencia',
    status: 'en_progreso',
    date: '06/02/2026 09:00',
    complaint: 'Dolor abdominal agudo',
  },
  {
    id: 'enc-004',
    patient: 'Ana Gonzalez',
    provider: 'Dr. Martinez',
    type: 'ambulatorio',
    status: 'completada',
    date: '05/02/2026 14:00',
    complaint: 'Infeccion urinaria',
    diagnosis: 'Cistitis aguda (N30.0)',
  },
  {
    id: 'enc-005',
    patient: 'Pedro Sanchez',
    provider: 'Dra. Lopez',
    type: 'ambulatorio',
    status: 'completada',
    date: '05/02/2026 10:00',
    complaint: 'Control diabetico',
    diagnosis: 'DM Tipo 2 controlada (E11.9)',
  },
  {
    id: 'enc-006',
    patient: 'Laura Diaz',
    provider: 'Dr. Martinez',
    type: 'hospitalizacion',
    status: 'en_progreso',
    date: '04/02/2026 16:00',
    complaint: 'Neumonia adquirida en comunidad',
    diagnosis: 'Neumonia (J18.9)',
  },
];

const typeConfig: Record<string, { label: string; variant: 'primary' | 'danger' | 'secondary' }> = {
  ambulatorio: { label: 'Ambulatorio', variant: 'primary' },
  emergencia: { label: 'Emergencia', variant: 'danger' },
  hospitalizacion: { label: 'Hospitalizacion', variant: 'secondary' },
};

// ─── Page ───────────────────────────────────────────────

export default function EMRPage() {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);

  const columns: Column<Encounter>[] = [
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      width: '150px',
      render: (row) => <span className="font-mono text-xs">{row.date}</span>,
    },
    {
      key: 'patient',
      header: 'Paciente',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-neutral-900">{row.patient}</span>
      ),
    },
    {
      key: 'provider',
      header: 'Proveedor',
      sortable: true,
      render: (row) => <span className="text-neutral-600">{row.provider}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => {
        const config = typeConfig[row.type];
        return config ? (
          <Badge variant={config.variant} size="sm">
            {config.label}
          </Badge>
        ) : (
          row.type
        );
      },
    },
    {
      key: 'complaint',
      header: 'Motivo de Consulta',
      render: (row) => (
        <span className="text-neutral-600 text-sm truncate max-w-xs block">
          {row.complaint}
        </span>
      ),
    },
    {
      key: 'diagnosis',
      header: 'Diagnostico',
      render: (row) =>
        row.diagnosis ? (
          <span className="text-neutral-700 text-xs">{row.diagnosis}</span>
        ) : (
          <span className="text-neutral-400 text-xs italic">Pendiente</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '120px',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Historia Clinica Electronica</h1>
          <p className="page-subtitle">Encuentros clinicos y documentacion medica</p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowNewModal(true)}
        >
          Nuevo Encuentro
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Encuentros', value: '6', icon: FileText, color: 'text-primary-600 bg-primary-50' },
          { label: 'En Progreso', value: '3', icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Completados', value: '3', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Emergencias', value: '1', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-lg border border-neutral-200 p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-neutral-900">{value}</p>
              <p className="text-2xs text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Encounters Table */}
      <Card padding="none">
        <DataTable
          columns={columns}
          data={encounters}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar por paciente, proveedor o diagnostico..."
          emptyMessage="No se encontraron encuentros clinicos."
          onRowClick={(row) => router.push(`/emr/${row.id}`)}
          className="p-4"
        />
      </Card>

      {/* New Encounter Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Iniciar Nuevo Encuentro Clinico"
        description="Seleccione el paciente y tipo de encuentro para comenzar."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowNewModal(false)}>
              Iniciar Encuentro
            </Button>
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
          <Select
            label="Tipo de Encuentro"
            required
            options={[
              { value: 'ambulatorio', label: 'Ambulatorio' },
              { value: 'emergencia', label: 'Emergencia' },
              { value: 'hospitalizacion', label: 'Hospitalizacion' },
            ]}
            placeholder="Seleccionar tipo"
          />
          <Input label="Fecha y Hora" type="datetime-local" required />
          <div className="md:col-span-2">
            <Textarea
              label="Motivo de Consulta"
              placeholder="Describa el motivo principal de la consulta..."
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
