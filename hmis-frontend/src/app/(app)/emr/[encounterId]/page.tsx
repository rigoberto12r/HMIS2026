'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { SOAPNoteEditor } from '@/components/clinical/soap-note-editor';
import { VitalSignsForm } from '@/components/clinical/vital-signs-form';
import { PrescriptionForm } from '@/components/clinical/prescription-form';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Activity,
  Pill,
  FileText,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';

// ─── Mock Encounter Data ────────────────────────────────

const encounter = {
  id: 'enc-002',
  patient: {
    name: 'Maria Rodriguez',
    mrn: 'HMIS-00000002',
    age: 35,
    gender: 'Femenino',
    blood_type: 'A+',
    allergies: ['Penicilina'],
  },
  provider: 'Dr. Martinez',
  type: 'ambulatorio',
  status: 'en_progreso',
  date: '06/02/2026 08:30',
  complaint: 'Control de hipertension',
  vitals: {
    systolic: 140,
    diastolic: 90,
    heart_rate: 78,
    temperature: 36.5,
    respiratory_rate: 16,
    oxygen_saturation: 98,
    weight: 68,
    height: 162,
  },
};

// ─── Sections ───────────────────────────────────────────

const sections = [
  { id: 'soap', label: 'Nota SOAP', icon: FileText },
  { id: 'vitals', label: 'Signos Vitales', icon: Activity },
  { id: 'prescriptions', label: 'Prescripciones', icon: Pill },
];

// ─── Page ───────────────────────────────────────────────

export default function EncounterDetailPage({
  params,
}: {
  params: { encounterId: string };
}) {
  const [activeSection, setActiveSection] = useState('soap');

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/emr"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a encuentros
      </Link>

      {/* Encounter Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Patient info */}
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-secondary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-neutral-900">
                  {encounter.patient.name}
                </h1>
                <StatusBadge status={encounter.status} />
              </div>
              <p className="text-sm text-neutral-500">
                <span className="font-mono">{encounter.patient.mrn}</span>
                <span className="mx-1.5">|</span>
                {encounter.patient.age} anos
                <span className="mx-1.5">|</span>
                {encounter.patient.gender}
                <span className="mx-1.5">|</span>
                <span className="text-neutral-400">
                  <Clock className="w-3 h-3 inline" /> {encounter.date}
                </span>
              </p>
            </div>
          </div>

          {/* Allergies warning */}
          {encounter.patient.allergies.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">
                Alergias: {encounter.patient.allergies.join(', ')}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<Save className="w-4 h-4" />}>
              Guardar Borrador
            </Button>
            <Button size="sm" leftIcon={<CheckCircle2 className="w-4 h-4" />} variant="success">
              Firmar y Cerrar
            </Button>
          </div>
        </div>

        {/* Encounter info */}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-neutral-500">Proveedor:</span>{' '}
            <span className="font-medium">{encounter.provider}</span>
          </div>
          <div>
            <span className="text-neutral-500">Tipo:</span>{' '}
            <Badge variant="primary" size="sm">
              {encounter.type === 'ambulatorio' ? 'Ambulatorio' : encounter.type}
            </Badge>
          </div>
          <div>
            <span className="text-neutral-500">Motivo:</span>{' '}
            <span className="font-medium">{encounter.complaint}</span>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="animate-in">
        {activeSection === 'soap' && <SOAPNoteEditor />}
        {activeSection === 'vitals' && <VitalSignsForm initialData={encounter.vitals} />}
        {activeSection === 'prescriptions' && <PrescriptionForm />}
      </div>
    </div>
  );
}
