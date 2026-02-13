'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Edit,
  Mail,
  Phone,
  Calendar,
  Heart,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Patient } from '@/hooks/usePatients';

interface PatientCardGridProps {
  patients: Patient[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPatientClick?: (patient: Patient) => void;
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
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
  ];
  const index = id.charCodeAt(0) % colors.length;
  return colors[index];
}

export function PatientCardGrid({
  patients,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPatientClick,
}: PatientCardGridProps) {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(pageSize)].map((_, i) => (
          <div
            key={i}
            className="h-64 bg-surface-100 dark:bg-surface-200 rounded-xl shimmer"
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
    <div className="space-y-6">
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {patients.map((patient) => (
          <Card
            key={patient.id}
            padding="none"
            className={cn(
              'group relative overflow-hidden transition-all duration-200 cursor-pointer',
              hoveredCard === patient.id && 'shadow-lg transform scale-105 z-10'
            )}
            onMouseEnter={() => setHoveredCard(patient.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => onPatientClick && onPatientClick(patient)}
          >
            {/* Header with Avatar */}
            <div className="relative h-24 bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
              <div
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white dark:ring-surface-100',
                  getAvatarColor(patient.id)
                )}
              >
                {getInitials(patient.first_name, patient.last_name)}
              </div>

              {/* Status badge */}
              <div className="absolute top-2 right-2">
                {patient.status === 'active' ? (
                  <Badge variant="success" size="sm" dot pulse>
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm" dot>
                    Inactivo
                  </Badge>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Name & MRN */}
              <div className="text-center">
                <h3 className="font-semibold text-surface-900 dark:text-surface-50 truncate">
                  {patient.first_name} {patient.last_name}
                </h3>
                <p className="text-xs text-surface-500 font-mono mt-0.5">{patient.mrn}</p>
              </div>

              {/* Key Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">Edad:</span>
                  <span className="font-medium text-surface-900 dark:text-surface-50">
                    {calculateAge(patient.date_of_birth)} años
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">Género:</span>
                  <Badge variant={patient.gender === 'M' ? 'info' : 'secondary'} size="sm">
                    {patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Femenino' : 'Otro'}
                  </Badge>
                </div>

                {patient.blood_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-surface-500">Sangre:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {patient.blood_type}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">Documento:</span>
                  <span className="font-mono text-xs text-surface-700 dark:text-surface-300 truncate max-w-[120px]">
                    {patient.document_number}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              {(patient.phone_number || patient.email) && (
                <div className="pt-3 border-t border-surface-200 dark:border-surface-700 space-y-1.5">
                  {patient.phone_number && (
                    <div className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{patient.phone_number}</span>
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons - Show on hover */}
              <div
                className={cn(
                  'flex items-center gap-2 pt-3 border-t border-surface-200 dark:border-surface-700 transition-opacity duration-200',
                  hoveredCard === patient.id ? 'opacity-100' : 'opacity-0'
                )}
              >
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/patients/${patient.id}`);
                  }}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/patients/${patient.id}/edit`);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Alerts indicator - would come from patient data */}
            {/* <div className="absolute top-2 left-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div> */}
          </Card>
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

          <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
            <span>Página {page} de {totalPages}</span>
            <span>•</span>
            <span>{total} total</span>
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
