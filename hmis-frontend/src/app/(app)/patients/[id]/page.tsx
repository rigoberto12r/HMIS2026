'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
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
  User,
  Droplets,
  DollarSign,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

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

interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  appointment_type: string;
  provider_name: string;
  status: string;
  notes?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  patient_id: string;
  total_amount: number;
  currency: string;
  status: string;
  issued_at: string;
  due_date: string;
  description?: string | null;
}

interface Diagnosis {
  id: string;
  patient_id: string;
  icd10_code: string;
  description: string;
  diagnosed_at: string;
  provider_name: string;
  notes?: string | null;
  status: string;
}

interface Allergy {
  id: string;
  patient_id: string;
  allergen: string;
  severity: string;
  reaction?: string | null;
  noted_at: string;
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

function formatGender(gender: string): string {
  if (gender === 'M') return 'Masculino';
  if (gender === 'F') return 'Femenino';
  return gender;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: currency || 'DOP',
  }).format(amount);
}

// ─── Tabs ───────────────────────────────────────────────

const tabs = [
  { id: 'datos', label: 'Datos Personales', icon: User },
  { id: 'historial', label: 'Historial Clinico', icon: FileText },
  { id: 'citas', label: 'Citas', icon: Calendar },
  { id: 'facturacion', label: 'Facturacion', icon: DollarSign },
];

// ─── Page ───────────────────────────────────────────────

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [activeTab, setActiveTab] = useState('datos');

  // Data state
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  // ─── Fetch Patient ──────────────────────────────────────

  const fetchPatient = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Patient>(`/patients/${patientId}`);
      setPatient(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos del paciente';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // ─── Fetch Tab Data ─────────────────────────────────────

  const fetchTabData = useCallback(async (tabId: string) => {
    if (loadedTabs.has(tabId)) return;
    setTabLoading(true);
    try {
      switch (tabId) {
        case 'historial': {
          const [diagData, allergyData] = await Promise.all([
            api.get<Diagnosis[]>(`/emr/diagnoses/patient/${patientId}`),
            api.get<Allergy[]>(`/emr/allergies/patient/${patientId}`),
          ]);
          setDiagnoses(diagData);
          setAllergies(allergyData);
          break;
        }
        case 'citas': {
          const aptData = await api.get<Appointment[]>('/appointments', {
            patient_id: patientId,
          });
          setAppointments(Array.isArray(aptData) ? aptData : []);
          break;
        }
        case 'facturacion': {
          const invData = await api.get<Invoice[]>('/billing/invoices', {
            patient_id: patientId,
          });
          setInvoices(Array.isArray(invData) ? invData : []);
          break;
        }
      }
      setLoadedTabs((prev) => new Set(prev).add(tabId));
    } catch (err) {
      // Silently handle tab data errors - show empty state
      console.error(`Error cargando datos de la pestana ${tabId}:`, err);
    } finally {
      setTabLoading(false);
    }
  }, [patientId, loadedTabs]);

  // ─── Effects ────────────────────────────────────────────

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  useEffect(() => {
    if (patient && activeTab !== 'datos') {
      fetchTabData(activeTab);
    }
  }, [activeTab, patient, fetchTabData]);

  // ─── Severity Colors ───────────────────────────────────

  const severityColors: Record<string, string> = {
    severe: 'bg-red-50 border-red-200 text-red-700',
    severa: 'bg-red-50 border-red-200 text-red-700',
    high: 'bg-red-50 border-red-200 text-red-700',
    moderate: 'bg-orange-50 border-orange-200 text-orange-700',
    moderada: 'bg-orange-50 border-orange-200 text-orange-700',
    mild: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    leve: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    low: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  // ─── Loading State ──────────────────────────────────────

  if (loading) {
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
            {error || 'No se encontro el paciente'}
          </p>
          <Button variant="outline" size="sm" onClick={fetchPatient}>
            Reintentar
          </Button>
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
        {/* Tab loading indicator */}
        {tabLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              <p className="text-sm text-neutral-500">Cargando...</p>
            </div>
          </div>
        )}

        {/* ─── Datos Personales ─── */}
        {activeTab === 'datos' && !tabLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Informacion Personal" />
              <dl className="space-y-3 text-sm">
                {[
                  ['Nombre completo', `${patient.first_name} ${patient.last_name}`],
                  ['Fecha de nacimiento', formatDate(patient.date_of_birth)],
                  ['Genero', formatGender(patient.gender)],
                  ['Grupo sanguineo', patient.blood_type || '---'],
                  ['Documento', `${patient.document_type ? patient.document_type.toUpperCase() + ': ' : ''}${patient.document_number}`],
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
        )}

        {/* ─── Historial Clinico ─── */}
        {activeTab === 'historial' && !tabLoading && (
          <div className="space-y-6">
            {/* Allergies */}
            <Card>
              <CardHeader title="Alergias Conocidas" />
              {allergies.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin alergias registradas</p>
              ) : (
                <div className="space-y-2">
                  {allergies.map((allergy) => (
                    <div
                      key={allergy.id}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        severityColors[allergy.severity.toLowerCase()] ||
                        'bg-neutral-50 border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium text-sm">{allergy.allergen}</span>
                        {allergy.reaction && (
                          <span className="text-xs opacity-75">({allergy.reaction})</span>
                        )}
                      </div>
                      <Badge
                        variant={
                          ['severe', 'severa', 'high'].includes(allergy.severity.toLowerCase())
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {allergy.severity.charAt(0).toUpperCase() + allergy.severity.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Diagnoses */}
            <Card>
              <CardHeader title="Diagnosticos" />
              {diagnoses.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin diagnosticos registrados</p>
              ) : (
                <div className="space-y-4">
                  {diagnoses.map((diagnosis) => (
                    <div
                      key={diagnosis.id}
                      className="p-4 bg-neutral-50 rounded-lg border border-neutral-100"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="primary" size="sm">
                              {diagnosis.icd10_code}
                            </Badge>
                            <span className="text-xs text-neutral-500">
                              {formatDate(diagnosis.diagnosed_at)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-neutral-800 mt-1">
                            {diagnosis.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-neutral-500">{diagnosis.provider_name}</span>
                          {diagnosis.status && (
                            <div className="mt-1">
                              <StatusBadge status={diagnosis.status} />
                            </div>
                          )}
                        </div>
                      </div>
                      {diagnosis.notes && (
                        <p className="text-sm text-neutral-600">{diagnosis.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ─── Citas ─── */}
        {activeTab === 'citas' && !tabLoading && (
          <Card>
            <CardHeader
              title="Historial de Citas"
              action={
                <Button size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
                  Nueva Cita
                </Button>
              }
            />
            {appointments.length === 0 ? (
              <p className="text-sm text-neutral-500">No hay citas registradas para este paciente.</p>
            ) : (
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
                    {appointments.map((apt) => (
                      <tr key={apt.id} className="border-t border-neutral-100">
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatDateTime(apt.scheduled_at)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{apt.appointment_type}</td>
                        <td className="px-4 py-3 text-neutral-600">{apt.provider_name}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={apt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ─── Facturacion ─── */}
        {activeTab === 'facturacion' && !tabLoading && (
          <Card>
            <CardHeader title="Facturas" />
            {invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">No hay facturas registradas para este paciente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="table-header px-4 py-3 text-left">No. Factura</th>
                      <th className="table-header px-4 py-3 text-left">Fecha</th>
                      <th className="table-header px-4 py-3 text-left">Descripcion</th>
                      <th className="table-header px-4 py-3 text-right">Monto</th>
                      <th className="table-header px-4 py-3 text-left">Vencimiento</th>
                      <th className="table-header px-4 py-3 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t border-neutral-100">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {formatDate(invoice.issued_at)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {invoice.description || '---'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-neutral-900">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
