'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Edit, MoreVertical, Mail, Phone, AlertTriangle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Patient } from '@/hooks/usePatients';

interface PatientListTableProps {
  patients: Patient[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPatientClick?: (patient: Patient) => void;
  selectedPatients?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

function getAvatarColor(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
  ];
  const index = id.charCodeAt(0) % colors.length;
  return colors[index];
}

export function PatientListTable({
  patients,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPatientClick,
  selectedPatients = new Set(),
  onSelectionChange,
}: PatientListTableProps) {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(new Set(patients.map((p) => p.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectPatient = (patientId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedPatients);
    if (checked) {
      newSelection.add(patientId);
    } else {
      newSelection.delete(patientId);
    }
    onSelectionChange(newSelection);
  };

  const handleRowClick = (patient: Patient, e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons or checkboxes
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input[type="checkbox"]')
    ) {
      return;
    }
    if (onPatientClick) {
      onPatientClick(patient);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(pageSize)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-surface-100 dark:bg-surface-200 rounded-lg shimmer"
          />
        ))}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-200 mb-4">
          <AlertTriangle className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">
          No se encontraron pacientes
        </h3>
        <p className="text-sm text-surface-500">
          Intenta ajustar los filtros o busca con otros términos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-50 dark:bg-surface-200 rounded-lg">
        <div className="flex items-center gap-3">
          {onSelectionChange && (
            <input
              type="checkbox"
              checked={selectedPatients.size === patients.length && patients.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
            />
          )}
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
            {total} pacientes
            {selectedPatients.size > 0 && ` (${selectedPatients.size} seleccionados)`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <span>Página {page} de {totalPages}</span>
        </div>
      </div>

      {/* Table Content */}
      <div className="space-y-2">
        {patients.map((patient) => (
          <div
            key={patient.id}
            onClick={(e) => handleRowClick(patient, e)}
            onMouseEnter={() => setHoveredRow(patient.id)}
            onMouseLeave={() => setHoveredRow(null)}
            className={cn(
              'group relative bg-white dark:bg-surface-100 rounded-lg border-2 transition-all duration-200 cursor-pointer',
              hoveredRow === patient.id
                ? 'border-primary-500 shadow-lg transform scale-[1.01]'
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300',
              selectedPatients.has(patient.id) && 'ring-2 ring-primary-500 border-primary-500'
            )}
          >
            <div className="flex items-center gap-4 p-4">
              {/* Checkbox */}
              {onSelectionChange && (
                <input
                  type="checkbox"
                  checked={selectedPatients.has(patient.id)}
                  onChange={(e) => handleSelectPatient(patient.id, e.target.checked)}
                  className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              {/* Avatar */}
              <div
                className={cn(
                  'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold',
                  getAvatarColor(patient.id)
                )}
              >
                {getInitials(patient.first_name, patient.last_name)}
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-surface-900 dark:text-surface-50 truncate">
                    {patient.first_name} {patient.last_name}
                  </h4>
                  {patient.status === 'active' && (
                    <Badge variant="success" size="sm" dot pulse>
                      Activo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-surface-500">
                  <span className="font-mono">{patient.mrn}</span>
                  <span>•</span>
                  <span>{patient.document_number}</span>
                  {patient.email && (
                    <>
                      <span>•</span>
                      <span className="truncate">{patient.email}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Age & Gender */}
              <div className="hidden md:flex items-center gap-2">
                <div className="text-center">
                  <div className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                    {calculateAge(patient.date_of_birth)}
                  </div>
                  <div className="text-2xs text-surface-500">años</div>
                </div>
                <Badge variant={patient.gender === 'M' ? 'info' : 'secondary'} size="sm">
                  {patient.gender === 'M' ? 'M' : patient.gender === 'F' ? 'F' : 'O'}
                </Badge>
              </div>

              {/* Blood Type */}
              {patient.blood_type && (
                <div className="hidden lg:block text-center px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">
                    {patient.blood_type}
                  </div>
                </div>
              )}

              {/* Last Visit & Next Appointment - Placeholder */}
              <div className="hidden xl:flex gap-4">
                <div className="text-center">
                  <div className="text-2xs text-surface-500 mb-1">Última visita</div>
                  <div className="text-xs font-medium text-surface-700 dark:text-surface-300">
                    --/--/----
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xs text-surface-500 mb-1">Próxima cita</div>
                  <div className="text-xs font-medium text-surface-700 dark:text-surface-300">
                    --/--/----
                  </div>
                </div>
              </div>

              {/* Alerts - Placeholder */}
              <div className="hidden lg:flex items-center gap-1">
                {/* Example alert icon - would come from patient data */}
                {/* <AlertTriangle className="w-5 h-5 text-amber-500" /> */}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/patients/${patient.id}`);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/patients/${patient.id}/edit`);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-200 rounded-lg">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>

          <div className="flex items-center gap-1">
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5) {
                if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    page === pageNum
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-surface-200 dark:hover:bg-surface-300 text-surface-600 dark:text-surface-400'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
