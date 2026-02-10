/**
 * Patient Detail Page - Refactored
 * Reduced from 645 lines using React Query and modular components
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, User, FileText, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePatient,
  usePatientAllergies,
  usePatientDiagnoses,
  usePatientAppointments,
  usePatientInvoices,
} from '@/hooks/usePatientDetail';
import { PatientHeader } from './components/PatientHeader';
import { PersonalDataTab } from './components/PersonalDataTab';
import { ClinicalHistoryTab } from './components/ClinicalHistoryTab';
import { AppointmentsTab } from './components/AppointmentsTab';
import { BillingTab } from './components/BillingTab';

type TabKey = 'datos' | 'historial' | 'citas' | 'facturacion';

const tabs = [
  { id: 'datos' as TabKey, label: 'Datos Personales', icon: User },
  { id: 'historial' as TabKey, label: 'Historial Clinico', icon: FileText },
  { id: 'citas' as TabKey, label: 'Citas', icon: Calendar },
  { id: 'facturacion' as TabKey, label: 'Facturacion', icon: DollarSign },
];

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>('datos');

  // Fetch patient data (always)
  const { data: patient, isLoading, error } = usePatient(patientId);

  // Lazy load tab data (only when tab is active)
  const {
    data: allergies = [],
    isLoading: loadingAllergies,
  } = usePatientAllergies(patientId, activeTab === 'historial');

  const {
    data: diagnoses = [],
    isLoading: loadingDiagnoses,
  } = usePatientDiagnoses(patientId, activeTab === 'historial');

  const {
    data: appointments = [],
    isLoading: loadingAppointments,
  } = usePatientAppointments(patientId, activeTab === 'citas');

  const {
    data: invoices = [],
    isLoading: loadingInvoices,
  } = usePatientInvoices(patientId, activeTab === 'facturacion');

  // ─── Loading State ──────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a pacientes
        </Link>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-neutral-500">Cargando datos del paciente...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a pacientes
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm font-medium text-red-800">
            {error instanceof Error ? error.message : 'No se encontro el paciente'}
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────

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
      <PatientHeader patient={patient} allergies={allergies} />

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
        {activeTab === 'datos' && <PersonalDataTab patient={patient} />}

        {activeTab === 'historial' && (
          <ClinicalHistoryTab
            allergies={allergies}
            diagnoses={diagnoses}
            loading={loadingAllergies || loadingDiagnoses}
          />
        )}

        {activeTab === 'citas' && (
          <AppointmentsTab appointments={appointments} loading={loadingAppointments} />
        )}

        {activeTab === 'facturacion' && (
          <BillingTab invoices={invoices} loading={loadingInvoices} />
        )}
      </div>
    </div>
  );
}
