'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Calendar,
  FileText,
  Shield,
  User,
  Heart,
  Droplets,
} from 'lucide-react';

// ─── Tabs ───────────────────────────────────────────────

const tabs = [
  { id: 'datos', label: 'Datos Personales', icon: User },
  { id: 'seguros', label: 'Seguros', icon: Shield },
  { id: 'historial', label: 'Historial Clinico', icon: FileText },
  { id: 'citas', label: 'Citas', icon: Calendar },
];

// ─── Mock Data ──────────────────────────────────────────

const patient = {
  id: '1',
  mrn: 'HMIS-00000001',
  first_name: 'Juan',
  last_name: 'Perez Garcia',
  document_number: '001-1234567-8',
  birth_date: '15/03/1985',
  age: 41,
  gender: 'Masculino',
  blood_type: 'O+',
  marital_status: 'Casado',
  phone: '809-555-0100',
  mobile: '829-555-0200',
  email: 'juan.perez@email.com',
  address: 'Calle Principal #123, Ensanche Naco, Santo Domingo',
  status: 'activo',
  allergies: [
    { name: 'Penicilina', severity: 'severa' },
    { name: 'Sulfas', severity: 'moderada' },
  ],
  emergency_contact: {
    name: 'Maria Perez',
    relationship: 'Esposa',
    phone: '809-555-0300',
  },
};

const insurancePolicies = [
  {
    id: '1',
    provider: 'ARS Humano',
    policy_number: 'HUM-123456',
    plan: 'Contributivo',
    copay: '20%',
    status: 'activo',
    valid_until: '31/12/2026',
  },
];

const clinicalHistory = [
  {
    date: '06/02/2026',
    type: 'Consulta General',
    provider: 'Dr. Martinez',
    diagnosis: 'Cefalea tensional (G44.2)',
    notes: 'Paciente refiere dolor de cabeza recurrente. Se indica tratamiento.',
  },
  {
    date: '15/01/2026',
    type: 'Control',
    provider: 'Dr. Martinez',
    diagnosis: 'Hipertension arterial (I10)',
    notes: 'Control de tension arterial. Valores estables con medicacion actual.',
  },
  {
    date: '20/12/2025',
    type: 'Consulta General',
    provider: 'Dra. Lopez',
    diagnosis: 'Dislipidemia (E78.5)',
    notes: 'Resultados de laboratorio muestran colesterol elevado. Ajuste de dieta.',
  },
];

const appointments = [
  {
    date: '10/02/2026 09:00',
    type: 'Control',
    provider: 'Dr. Martinez',
    status: 'confirmada',
  },
  {
    date: '06/02/2026 08:00',
    type: 'Consulta General',
    provider: 'Dr. Martinez',
    status: 'completada',
  },
  {
    date: '15/01/2026 10:00',
    type: 'Control',
    provider: 'Dr. Martinez',
    status: 'completada',
  },
  {
    date: '20/12/2025 14:00',
    type: 'Consulta General',
    provider: 'Dra. Lopez',
    status: 'completada',
  },
];

// ─── Page ───────────────────────────────────────────────

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('datos');

  const severityColors: Record<string, string> = {
    severa: 'bg-red-50 border-red-200 text-red-700',
    moderada: 'bg-orange-50 border-orange-200 text-orange-700',
    leve: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a pacientes
      </Link>

      {/* Patient Header */}
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
              <StatusBadge status={patient.status} />
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              <span className="font-mono">MRN: {patient.mrn}</span>
              <span className="mx-2">|</span>
              Cedula: {patient.document_number}
              <span className="mx-2">|</span>
              {patient.age} anos
              <span className="mx-2">|</span>
              {patient.gender}
            </p>

            {/* Quick info badges */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="danger" size="sm">
                <Droplets className="w-3 h-3" /> {patient.blood_type}
              </Badge>
              {patient.allergies.map((allergy) => (
                <Badge key={allergy.name} variant="warning" size="sm">
                  <AlertCircle className="w-3 h-3" /> {allergy.name}
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

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in">
        {/* ─── Datos Personales ─── */}
        {activeTab === 'datos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Informacion Personal" />
              <dl className="space-y-3 text-sm">
                {[
                  ['Nombre completo', `${patient.first_name} ${patient.last_name}`],
                  ['Fecha de nacimiento', patient.birth_date],
                  ['Genero', patient.gender],
                  ['Estado civil', patient.marital_status],
                  ['Grupo sanguineo', patient.blood_type],
                  ['Documento', patient.document_number],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="font-medium text-neutral-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Informacion de Contacto" />
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2 py-1">
                  <Phone className="w-4 h-4 text-neutral-400" />
                  <dt className="text-neutral-500 w-20">Telefono</dt>
                  <dd className="font-medium">{patient.phone}</dd>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Phone className="w-4 h-4 text-neutral-400" />
                  <dt className="text-neutral-500 w-20">Celular</dt>
                  <dd className="font-medium">{patient.mobile}</dd>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Mail className="w-4 h-4 text-neutral-400" />
                  <dt className="text-neutral-500 w-20">Email</dt>
                  <dd className="font-medium text-primary-600">{patient.email}</dd>
                </div>
                <div className="flex items-start gap-2 py-1">
                  <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                  <dt className="text-neutral-500 w-20">Direccion</dt>
                  <dd className="font-medium">{patient.address}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <CardHeader title="Alergias Conocidas" />
              {patient.allergies.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin alergias registradas</p>
              ) : (
                <div className="space-y-2">
                  {patient.allergies.map((allergy) => (
                    <div
                      key={allergy.name}
                      className={`p-3 rounded-lg border flex items-center justify-between ${severityColors[allergy.severity]}`}
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium text-sm">{allergy.name}</span>
                      </div>
                      <Badge
                        variant={allergy.severity === 'severa' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {allergy.severity.charAt(0).toUpperCase() + allergy.severity.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Contacto de Emergencia" />
              <dl className="space-y-3 text-sm">
                {[
                  ['Nombre', patient.emergency_contact.name],
                  ['Relacion', patient.emergency_contact.relationship],
                  ['Telefono', patient.emergency_contact.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="font-medium text-neutral-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        )}

        {/* ─── Seguros ─── */}
        {activeTab === 'seguros' && (
          <Card>
            <CardHeader
              title="Polizas de Seguro"
              action={
                <Button variant="outline" size="sm">
                  Agregar Poliza
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3 text-left">Aseguradora</th>
                    <th className="table-header px-4 py-3 text-left">No. Poliza</th>
                    <th className="table-header px-4 py-3 text-left">Plan</th>
                    <th className="table-header px-4 py-3 text-left">Copago</th>
                    <th className="table-header px-4 py-3 text-left">Vigencia</th>
                    <th className="table-header px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {insurancePolicies.map((policy) => (
                    <tr key={policy.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-medium text-neutral-900">{policy.provider}</td>
                      <td className="px-4 py-3 font-mono text-xs">{policy.policy_number}</td>
                      <td className="px-4 py-3 text-neutral-600">{policy.plan}</td>
                      <td className="px-4 py-3 text-neutral-600">{policy.copay}</td>
                      <td className="px-4 py-3 text-neutral-500">{policy.valid_until}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={policy.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ─── Historial Clinico ─── */}
        {activeTab === 'historial' && (
          <Card>
            <CardHeader title="Historial de Encuentros Clinicos" />
            <div className="space-y-4">
              {clinicalHistory.map((record, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-neutral-50 rounded-lg border border-neutral-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          {record.type}
                        </Badge>
                        <span className="text-xs text-neutral-500">{record.date}</span>
                      </div>
                      <p className="text-sm font-medium text-neutral-800 mt-1">
                        {record.diagnosis}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500">{record.provider}</span>
                  </div>
                  <p className="text-sm text-neutral-600">{record.notes}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Citas ─── */}
        {activeTab === 'citas' && (
          <Card>
            <CardHeader
              title="Historial de Citas"
              action={
                <Button size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
                  Nueva Cita
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3 text-left">Fecha y Hora</th>
                    <th className="table-header px-4 py-3 text-left">Tipo</th>
                    <th className="table-header px-4 py-3 text-left">Proveedor</th>
                    <th className="table-header px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt, idx) => (
                    <tr key={idx} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-mono text-xs">{apt.date}</td>
                      <td className="px-4 py-3 text-neutral-600">{apt.type}</td>
                      <td className="px-4 py-3 text-neutral-600">{apt.provider}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={apt.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
