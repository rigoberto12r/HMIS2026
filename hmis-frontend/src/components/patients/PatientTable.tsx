'use client';

import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Patient } from '@/hooks/usePatients';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

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

export function PatientTable({
  patients,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
}: PatientTableProps) {
  const router = useRouter();

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
      render: (row) => <span className="text-sm">{calculateAge(row.date_of_birth)} años</span>,
    },
    {
      key: 'gender',
      header: 'Género',
      render: (row) => (
        <Badge variant={row.gender === 'M' ? 'blue' : 'pink'}>
          {row.gender === 'M' ? 'Masculino' : 'Femenino'}
        </Badge>
      ),
    },
    {
      key: 'blood_type',
      header: 'Tipo Sangre',
      render: (row) => (
        <span className="text-sm font-medium text-medical-red">{row.blood_type || '---'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <StatusBadge status={row.status || 'active'} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '100px',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/patients/${row.id}`)}
          aria-label={`Ver detalles de ${row.first_name} ${row.last_name}`}
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={patients}
      keyExtractor={(patient) => patient.id}
      loading={loading}
      pageSize={pageSize}
      emptyMessage="No se encontraron pacientes"
    />
  );
}
