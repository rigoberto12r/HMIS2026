/**
 * PatientHeader Component
 * Displays patient avatar, name, MRN, and quick info badges
 */

import { Edit, Droplets, AlertCircle } from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Patient, Allergy } from '@/hooks/usePatientDetail';

interface Props {
  patient: Patient;
  allergies: Allergy[];
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

function formatGender(gender: string): string {
  if (gender === 'M') return 'Masculino';
  if (gender === 'F') return 'Femenino';
  return gender;
}

export function PatientHeader({ patient, allergies }: Props) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-card">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-primary-700 text-xl font-bold">
            {patient.first_name[0]}
            {patient.last_name[0]}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-neutral-900">
              {patient.first_name} {patient.last_name}
            </h1>
            <StatusBadge status={patient.is_active ? 'activo' : 'inactivo'} />
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            <span className="font-mono">MRN: {patient.mrn}</span>
            <span className="mx-2">|</span>
            Cedula: {patient.document_number}
            <span className="mx-2">|</span>
            {calculateAge(patient.date_of_birth)} anos
            <span className="mx-2">|</span>
            {formatGender(patient.gender)}
          </p>

          {/* Quick info badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {patient.blood_type && (
              <Badge variant="danger" size="sm">
                <Droplets className="w-3 h-3" /> {patient.blood_type}
              </Badge>
            )}
            {allergies.map((allergy) => (
              <Badge key={allergy.id} variant="warning" size="sm">
                <AlertCircle className="w-3 h-3" /> {allergy.allergen}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" leftIcon={<Edit className="w-4 h-4" />}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
