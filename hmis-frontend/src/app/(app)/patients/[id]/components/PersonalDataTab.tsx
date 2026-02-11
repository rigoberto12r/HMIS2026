/**
 * PersonalDataTab Component
 * Displays patient personal information in 4 cards
 */

import { Phone, Mail, MapPin } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import type { Patient } from '@/hooks/usePatientDetail';

interface Props {
  patient: Patient;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatGender(gender: string): string {
  if (gender === 'M') return 'Masculino';
  if (gender === 'F') return 'Femenino';
  return gender;
}

export function PersonalDataTab({ patient }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Personal Information */}
      <Card>
        <CardHeader title="Informacion Personal" />
        <dl className="space-y-3 text-sm">
          {[
            ['Nombre completo', `${patient.first_name} ${patient.last_name}`],
            ['Fecha de nacimiento', formatDate(patient.date_of_birth)],
            ['Genero', formatGender(patient.gender)],
            ['Grupo sanguineo', patient.blood_type || '---'],
            [
              'Documento',
              `${patient.document_type ? patient.document_type.toUpperCase() + ': ' : ''}${
                patient.document_number
              }`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-1">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="font-medium text-neutral-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader title="Informacion de Contacto" />
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2 py-1">
            <Phone className="w-4 h-4 text-neutral-400" />
            <dt className="text-neutral-500 w-20">Telefono</dt>
            <dd className="font-medium">{patient.phone || '---'}</dd>
          </div>
          <div className="flex items-center gap-2 py-1">
            <Mail className="w-4 h-4 text-neutral-400" />
            <dt className="text-neutral-500 w-20">Email</dt>
            <dd className="font-medium text-primary-600">{patient.email || '---'}</dd>
          </div>
          <div className="flex items-start gap-2 py-1">
            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
            <dt className="text-neutral-500 w-20">Direccion</dt>
            <dd className="font-medium">{patient.address || '---'}</dd>
          </div>
        </dl>
      </Card>

      {/* Insurance Information */}
      <Card>
        <CardHeader title="Seguro Medico" />
        <dl className="space-y-3 text-sm">
          {[
            ['Aseguradora', patient.insurance_provider || '---'],
            ['Numero de Poliza', patient.insurance_number || '---'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-1">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="font-medium text-neutral-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader title="Contacto de Emergencia" />
        <dl className="space-y-3 text-sm">
          {[
            ['Nombre', patient.emergency_contact_name || '---'],
            ['Telefono', patient.emergency_contact_phone || '---'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-1">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="font-medium text-neutral-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
