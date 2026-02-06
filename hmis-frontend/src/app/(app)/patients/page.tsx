'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { UserPlus, Search, Filter, Download, Users, Loader2, AlertTriangle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  document_type: string;
  document_number: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  blood_type: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface NewPatientForm {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  document_type: string;
  document_number: string;
  email: string;
  phone: string;
  address: string;
  blood_type: string;
  insurance_provider: string;
  insurance_number: string;
}

// ─── Helpers ────────────────────────────────────────────

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const emptyForm: NewPatientForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  document_type: 'cedula',
  document_number: '',
  email: '',
  phone: '',
  address: '',
  blood_type: '',
  insurance_provider: '',
  insurance_number: '',
};

const genderOptions = [
  { value: '', label: 'Todos los generos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

const genderFormOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

const bloodTypeOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

const documentTypeOptions = [
  { value: 'cedula', label: 'Cedula' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'otro', label: 'Otro' },
];

// ─── Page ───────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();

  // Data state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter state
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [formData, setFormData] = useState<NewPatientForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Fetch Patients ─────────────────────────────────────

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PaginatedResponse>('/patients', {
        page,
        page_size: pageSize,
        search: search || undefined,
        gender: genderFilter || undefined,
      });
      setPatients(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar pacientes';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, search, genderFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, genderFilter]);

  // ─── Create Patient ─────────────────────────────────────

  const handleCreatePatient = useCallback(async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post<Patient>('/patients', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        document_type: formData.document_type,
        document_number: formData.document_number,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        blood_type: formData.blood_type || null,
        insurance_provider: formData.insurance_provider || null,
        insurance_number: formData.insurance_number || null,
      });
      setShowNewModal(false);
      setFormData(emptyForm);
      fetchPatients();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear paciente';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }, [formData, fetchPatients]);

  const handleFormChange = useCallback((field: keyof NewPatientForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ─── Stats ──────────────────────────────────────────────

  const activeCount = patients.filter((p) => p.is_active).length;
  const withInsuranceCount = patients.filter((p) => p.insurance_provider).length;

  // ─── Table Columns ──────────────────────────────────────

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
          <p className="text-2xs text-neutral-400">{row.email || '---'}</p>
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
      key: 'date_of_birth',
      header: 'Edad',
      sortable: true,
      width: '80px',
      render: (row) => (
        <span>
          {calculateAge(row.date_of_birth)} <span className="text-neutral-400">a.</span>
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
      render: (row) => <span className="text-neutral-600">{row.phone || '---'}</span>,
    },
    {
      key: 'insurance_provider',
      header: 'Seguro',
      sortable: true,
      render: (row) => (
        <span className="text-neutral-600 text-xs">{row.insurance_provider || '---'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      width: '100px',
      render: (row) => <StatusBadge status={row.is_active ? 'activo' : 'inactivo'} />,
    },
    {
      key: 'created_at',
      header: 'Registrado',
      sortable: true,
      width: '110px',
      render: (row) => (
        <span className="text-neutral-500 text-xs">
          {new Date(row.created_at).toLocaleDateString('es-DO')}
        </span>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">
            Registro y gestion de pacientes ({total} registrados)
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="form-input text-sm py-1.5 w-auto"
              aria-label="Filtrar por genero"
            >
              <option value="">Todos los generos</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Pacientes', value: String(total), icon: Users, color: 'text-primary-600' },
          { label: 'Activos', value: String(activeCount), icon: Users, color: 'text-green-600' },
          { label: 'En esta pagina', value: String(patients.length), icon: UserPlus, color: 'text-secondary-600' },
          { label: 'Con Seguro', value: String(withInsuranceCount), icon: Users, color: 'text-blue-600' },
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

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error al cargar pacientes</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPatients}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Data Table */}
      <Card padding="none">
        <DataTable
          columns={columns}
          data={patients}
          keyExtractor={(row) => row.id}
          pageSize={pageSize}
          searchable
          searchPlaceholder="Buscar en tabla..."
          emptyMessage="No se encontraron pacientes con los filtros seleccionados."
          loading={loading}
          onRowClick={(row) => router.push(`/patients/${row.id}`)}
          className="p-4"
        />
      </Card>

      {/* New Patient Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setFormData(emptyForm);
          setFormError(null);
        }}
        title="Registrar Nuevo Paciente"
        description="Complete los datos del paciente para crear su expediente."
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewModal(false);
                setFormData(emptyForm);
                setFormError(null);
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePatient}
              disabled={submitting || !formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.gender || !formData.document_number}
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {submitting ? 'Guardando...' : 'Guardar Paciente'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              placeholder="Nombre del paciente"
              required
              value={formData.first_name}
              onChange={(e) => handleFormChange('first_name', e.target.value)}
            />
            <Input
              label="Apellido"
              placeholder="Apellido del paciente"
              required
              value={formData.last_name}
              onChange={(e) => handleFormChange('last_name', e.target.value)}
            />
            <Select
              label="Tipo de Documento"
              options={documentTypeOptions}
              required
              value={formData.document_type}
              onChange={(e) => handleFormChange('document_type', e.target.value)}
            />
            <Input
              label="Numero de Documento"
              placeholder="000-0000000-0"
              required
              value={formData.document_number}
              onChange={(e) => handleFormChange('document_number', e.target.value)}
            />
            <Input
              label="Fecha de Nacimiento"
              type="date"
              required
              value={formData.date_of_birth}
              onChange={(e) => handleFormChange('date_of_birth', e.target.value)}
            />
            <Select
              label="Genero"
              options={genderFormOptions}
              placeholder="Seleccionar genero"
              required
              value={formData.gender}
              onChange={(e) => handleFormChange('gender', e.target.value)}
            />
            <Input
              label="Telefono"
              placeholder="809-000-0000"
              value={formData.phone}
              onChange={(e) => handleFormChange('phone', e.target.value)}
            />
            <Input
              label="Correo Electronico"
              type="email"
              placeholder="correo@ejemplo.com"
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
            />
            <Select
              label="Grupo Sanguineo"
              options={bloodTypeOptions}
              value={formData.blood_type}
              onChange={(e) => handleFormChange('blood_type', e.target.value)}
            />
            <Input
              label="Aseguradora"
              placeholder="Nombre de la aseguradora"
              value={formData.insurance_provider}
              onChange={(e) => handleFormChange('insurance_provider', e.target.value)}
            />
            <Input
              label="Numero de Poliza"
              placeholder="Numero de poliza"
              value={formData.insurance_number}
              onChange={(e) => handleFormChange('insurance_number', e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                label="Direccion"
                placeholder="Calle, numero, ciudad"
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
