'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { UserPlus, Search, Filter, Download, Users } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  document_number: string;
  gender: string;
  age: number;
  phone: string;
  email: string;
  status: string;
  insurance: string;
  last_visit: string;
}

// ─── Mock Data ──────────────────────────────────────────

const mockPatients: Patient[] = [
  {
    id: '1',
    mrn: 'HMIS-00000001',
    first_name: 'Juan',
    last_name: 'Perez Garcia',
    document_number: '001-1234567-8',
    gender: 'M',
    age: 41,
    phone: '809-555-0100',
    email: 'juan.perez@email.com',
    status: 'activo',
    insurance: 'ARS Humano',
    last_visit: '06/02/2026',
  },
  {
    id: '2',
    mrn: 'HMIS-00000002',
    first_name: 'Maria',
    last_name: 'Rodriguez Mejia',
    document_number: '001-9876543-2',
    gender: 'F',
    age: 35,
    phone: '829-555-0200',
    email: 'maria.rodriguez@email.com',
    status: 'activo',
    insurance: 'ARS Universal',
    last_visit: '05/02/2026',
  },
  {
    id: '3',
    mrn: 'HMIS-00000003',
    first_name: 'Carlos',
    last_name: 'Martinez Lopez',
    document_number: '402-5551234-5',
    gender: 'M',
    age: 58,
    phone: '809-555-0300',
    email: 'carlos.martinez@email.com',
    status: 'activo',
    insurance: 'Senasa',
    last_visit: '04/02/2026',
  },
  {
    id: '4',
    mrn: 'HMIS-00000004',
    first_name: 'Ana',
    last_name: 'Gonzalez Reyes',
    document_number: '001-4445556-7',
    gender: 'F',
    age: 28,
    phone: '849-555-0400',
    email: 'ana.gonzalez@email.com',
    status: 'activo',
    insurance: 'ARS Humano',
    last_visit: '03/02/2026',
  },
  {
    id: '5',
    mrn: 'HMIS-00000005',
    first_name: 'Pedro',
    last_name: 'Sanchez Diaz',
    document_number: '001-7778889-0',
    gender: 'M',
    age: 67,
    phone: '809-555-0500',
    email: 'pedro.sanchez@email.com',
    status: 'activo',
    insurance: 'Senasa',
    last_visit: '01/02/2026',
  },
  {
    id: '6',
    mrn: 'HMIS-00000006',
    first_name: 'Laura',
    last_name: 'Diaz Fernandez',
    document_number: '001-3334445-6',
    gender: 'F',
    age: 45,
    phone: '829-555-0600',
    email: 'laura.diaz@email.com',
    status: 'inactivo',
    insurance: 'ARS Palic',
    last_visit: '15/01/2026',
  },
  {
    id: '7',
    mrn: 'HMIS-00000007',
    first_name: 'Roberto',
    last_name: 'Hernandez Cruz',
    document_number: '001-1112223-4',
    gender: 'M',
    age: 52,
    phone: '809-555-0700',
    email: 'roberto.hernandez@email.com',
    status: 'activo',
    insurance: 'ARS Universal',
    last_visit: '06/02/2026',
  },
  {
    id: '8',
    mrn: 'HMIS-00000008',
    first_name: 'Carmen',
    last_name: 'Reyes Castillo',
    document_number: '001-8889990-1',
    gender: 'F',
    age: 33,
    phone: '849-555-0800',
    email: 'carmen.reyes@email.com',
    status: 'activo',
    insurance: 'ARS Humano',
    last_visit: '05/02/2026',
  },
];

// ─── Page ───────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const filteredPatients =
    statusFilter === 'todos'
      ? mockPatients
      : mockPatients.filter((p) => p.status === statusFilter);

  const columns: Column<Patient>[] = [
    {
      key: 'mrn',
      header: 'MRN',
      sortable: true,
      width: '140px',
      render: (row) => (
        <span className="font-mono text-primary-600 font-medium text-xs">{row.mrn}</span>
      ),
    },
    {
      key: 'last_name',
      header: 'Nombre',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-neutral-900">
            {row.first_name} {row.last_name}
          </p>
          <p className="text-2xs text-neutral-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'document_number',
      header: 'Documento',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.document_number}</span>,
    },
    {
      key: 'age',
      header: 'Edad',
      sortable: true,
      width: '80px',
      render: (row) => (
        <span>
          {row.age} <span className="text-neutral-400">a.</span>
        </span>
      ),
    },
    {
      key: 'gender',
      header: 'Sexo',
      width: '60px',
      render: (row) => (
        <Badge variant={row.gender === 'M' ? 'info' : 'secondary'} size="sm">
          {row.gender === 'M' ? 'Masc' : 'Fem'}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Telefono',
      render: (row) => <span className="text-neutral-600">{row.phone}</span>,
    },
    {
      key: 'insurance',
      header: 'Seguro',
      sortable: true,
      render: (row) => <span className="text-neutral-600 text-xs">{row.insurance}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '100px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'last_visit',
      header: 'Ultima Visita',
      sortable: true,
      width: '110px',
      render: (row) => <span className="text-neutral-500 text-xs">{row.last_visit}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">
            Registro y gestion de pacientes ({mockPatients.length} registrados)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Exportar
          </Button>
          <Button
            size="sm"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => setShowNewModal(true)}
          >
            Nuevo Paciente
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full sm:max-w-md">
            <Input
              placeholder="Buscar por nombre, MRN o documento..."
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input text-sm py-1.5 w-auto"
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Pacientes', value: '8', icon: Users, color: 'text-primary-600' },
          { label: 'Activos', value: '7', icon: Users, color: 'text-green-600' },
          { label: 'Nuevos (mes)', value: '3', icon: UserPlus, color: 'text-secondary-600' },
          { label: 'Con Seguro', value: '8', icon: Users, color: 'text-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-lg border border-neutral-200 p-3 flex items-center gap-3"
          >
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <p className="text-lg font-bold text-neutral-900">{value}</p>
              <p className="text-2xs text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Data Table */}
      <Card padding="none">
        <DataTable
          columns={columns}
          data={filteredPatients}
          keyExtractor={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder="Buscar en tabla..."
          emptyMessage="No se encontraron pacientes con los filtros seleccionados."
          onRowClick={(row) => router.push(`/patients/${row.id}`)}
          className="p-4"
        />
      </Card>

      {/* New Patient Modal (stub) */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Registrar Nuevo Paciente"
        description="Complete los datos del paciente para crear su expediente."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowNewModal(false)}>Guardar Paciente</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nombre" placeholder="Nombre del paciente" required />
          <Input label="Apellido" placeholder="Apellido del paciente" required />
          <Input label="Cedula / Documento" placeholder="000-0000000-0" required />
          <Input label="Fecha de Nacimiento" type="date" required />
          <Input label="Telefono" placeholder="809-000-0000" />
          <Input label="Correo Electronico" type="email" placeholder="correo@ejemplo.com" />
          <div className="md:col-span-2">
            <Input label="Direccion" placeholder="Calle, numero, ciudad" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
