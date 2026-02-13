'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { usePatient } from '@/hooks/usePatients';
import { useEncounters } from '@/hooks/useEncounters';
import {
  ArrowLeft,
  User,
  Calendar,
  FileText,
  Pill,
  AlertTriangle,
  Activity,
  ClipboardList,
  Heart,
  Stethoscope,
  Clock,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/components/ui/tabs';

/**
 * Patient Clinical History Page
 *
 * Features:
 * - Complete medical history view
 * - Tabbed interface: Overview, Encounters, Diagnoses, Medications, Allergies, Vitals
 * - Timeline of medical events
 * - Dark mode compatible
 * - Mobile responsive
 * - Loading states and error handling
 */

export default function PatientHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [activeTab, setActiveTab] = useState('overview');

  // Fetch patient data
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(patientId);

  // Fetch encounters for this patient
  const { data: encountersData, isLoading: encountersLoading } = useEncounters({
    patient_id: patientId,
    page: 1,
    page_size: 50,
  });

  const encounters = encountersData?.items || [];

  const goBack = () => {
    router.push('/patients');
  };

  // Calculate patient age
  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Tab configuration
  const tabs: Tab[] = [
    { id: 'overview', label: 'Resumen', icon: <User className="w-4 h-4" /> },
    { id: 'encounters', label: 'Consultas', icon: <Stethoscope className="w-4 h-4" />, badge: encounters.length },
    { id: 'diagnoses', label: 'Diagnósticos', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'medications', label: 'Medicamentos', icon: <Pill className="w-4 h-4" /> },
    { id: 'allergies', label: 'Alergias', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'vitals', label: 'Signos Vitales', icon: <Activity className="w-4 h-4" /> },
  ];

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-surface-500">Cargando historial del paciente...</p>
        </div>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent>
            <div className="flex items-start gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  Error al cargar el paciente
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  {patientError instanceof Error ? patientError.message : 'Paciente no encontrado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={goBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Pacientes
        </Button>
      </div>
    );
  }

  const age = calculateAge(patient.date_of_birth);

  // Extract all diagnoses from encounters
  const allDiagnoses = encounters.flatMap((enc) =>
    (enc.diagnoses || []).map(diag => ({ ...diag, encounter_date: enc.start_datetime }))
  );

  // Extract all medications from encounters (orders of type 'medication')
  const allMedications = encounters.flatMap((enc) =>
    (enc.orders || [])
      .filter(order => order.order_type === 'medication')
      .map(med => ({ ...med, encounter_date: enc.start_datetime }))
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={goBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-1">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-surface-500">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {age} años
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(patient.date_of_birth)}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                MRN: {patient.mrn}
              </span>
            </div>
          </div>
          <Button onClick={() => router.push(`/patients/${patientId}`)}>
            Ver Perfil Completo
          </Button>
        </div>
      </div>

      {/* Patient Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="hover:-translate-y-0.5 transition-transform">
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                {encounters.length}
              </p>
              <p className="text-sm text-surface-500">Consultas Totales</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 transition-transform">
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-50 dark:bg-accent-900/30 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                {allDiagnoses.length}
              </p>
              <p className="text-sm text-surface-500">Diagnósticos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 transition-transform">
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                {patient.allergies ? '1+' : '0'}
              </p>
              <p className="text-sm text-surface-500">Alergias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="mb-6">
        <div className="border-b border-surface-200 dark:border-surface-700">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            variant="underline"
          />
        </div>

        <CardContent>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <TabPanel id="overview">
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-500" />
                    Información Personal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem label="Sexo" value={patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Femenino' : 'Otro'} />
                    <InfoItem label="Tipo de Sangre" value={patient.blood_type || 'No especificado'} />
                    <InfoItem label="Documento" value={`${patient.document_type}: ${patient.document_number}`} />
                    <InfoItem label="Estado" value={patient.status} />
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary-500" />
                    Contacto
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem
                      icon={<Phone className="w-4 h-4" />}
                      label="Teléfono"
                      value={patient.phone_number || 'No especificado'}
                    />
                    <InfoItem
                      icon={<Mail className="w-4 h-4" />}
                      label="Email"
                      value={patient.email || 'No especificado'}
                    />
                  </div>
                </div>

                {/* Allergies */}
                {patient.allergies && (
                  <div>
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Alergias
                    </h3>
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                      <CardContent>
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          {patient.allergies}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-500" />
                    Actividad Reciente
                  </h3>
                  {encounters.length === 0 ? (
                    <p className="text-sm text-surface-500 italic">
                      No hay consultas registradas para este paciente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {encounters.slice(0, 5).map((encounter) => (
                        <Card key={encounter.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="flex items-center justify-between py-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Stethoscope className="w-5 h-5 text-primary-500" />
                              </div>
                              <div>
                                <p className="font-medium text-surface-900 dark:text-surface-50">
                                  {encounter.reason || 'Consulta general'}
                                </p>
                                <p className="text-sm text-surface-500 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDateTime(encounter.start_datetime)}
                                </p>
                                {encounter.chief_complaint && (
                                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                                    {encounter.chief_complaint}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/emr/encounters/${encounter.id}`)}
                            >
                              Ver Detalles
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabPanel>
          )}

          {/* Encounters Tab */}
          {activeTab === 'encounters' && (
            <TabPanel id="encounters">
              <div className="space-y-3">
                {encountersLoading ? (
                  <p className="text-center text-surface-500 py-8">Cargando consultas...</p>
                ) : encounters.length === 0 ? (
                  <p className="text-center text-surface-500 py-8 italic">
                    No hay consultas registradas para este paciente.
                  </p>
                ) : (
                  encounters.map((encounter) => (
                    <Card key={encounter.id} className="hover:shadow-md transition-shadow">
                      <CardContent>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-surface-900 dark:text-surface-50">
                              {encounter.reason || 'Consulta general'}
                            </h4>
                            <p className="text-sm text-surface-500 mt-1">
                              {formatDateTime(encounter.start_datetime)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              encounter.status === 'completed' &&
                                'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
                              encounter.status === 'active' &&
                                'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
                              encounter.status === 'cancelled' &&
                                'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {encounter.status === 'completed' ? 'Completada' :
                             encounter.status === 'active' ? 'Activa' : 'Cancelada'}
                          </span>
                        </div>

                        {encounter.chief_complaint && (
                          <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
                            <strong>Motivo:</strong> {encounter.chief_complaint}
                          </p>
                        )}

                        {encounter.diagnoses && encounter.diagnoses.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                            <p className="text-xs font-medium text-surface-500 mb-2">Diagnósticos:</p>
                            <div className="flex flex-wrap gap-2">
                              {encounter.diagnoses.map((diag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs bg-surface-100 dark:bg-surface-200 text-surface-700 dark:text-surface-300 rounded"
                                >
                                  {diag.code}: {diag.description}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabPanel>
          )}

          {/* Diagnoses Tab */}
          {activeTab === 'diagnoses' && (
            <TabPanel id="diagnoses">
              <div className="space-y-3">
                {allDiagnoses.length === 0 ? (
                  <p className="text-center text-surface-500 py-8 italic">
                    No hay diagnósticos registrados para este paciente.
                  </p>
                ) : (
                  allDiagnoses.map((diag, idx) => (
                    <Card key={idx}>
                      <CardContent className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-accent-50 dark:bg-accent-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-5 h-5 text-accent-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-surface-900 dark:text-surface-50">
                                {diag.description}
                              </h4>
                              <p className="text-sm text-surface-500 mt-1">
                                Código: {diag.code}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'px-2 py-1 text-xs font-medium rounded-full',
                                diag.type === 'primary'
                                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                  : 'bg-surface-100 text-surface-700 dark:bg-surface-200 dark:text-surface-300'
                              )}
                            >
                              {diag.type === 'primary' ? 'Principal' : 'Secundario'}
                            </span>
                          </div>
                          <p className="text-xs text-surface-400 mt-2">
                            Fecha: {formatDate(diag.encounter_date)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabPanel>
          )}

          {/* Medications Tab */}
          {activeTab === 'medications' && (
            <TabPanel id="medications">
              <div className="space-y-3">
                {allMedications.length === 0 ? (
                  <p className="text-center text-surface-500 py-8 italic">
                    No hay medicamentos registrados para este paciente.
                  </p>
                ) : (
                  allMedications.map((med, idx) => (
                    <Card key={idx}>
                      <CardContent className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Pill className="w-5 h-5 text-primary-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-surface-900 dark:text-surface-50">
                                {med.description}
                              </h4>
                              {med.notes && (
                                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                                  {med.notes}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                'px-2 py-1 text-xs font-medium rounded-full',
                                med.status === 'completed' &&
                                  'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
                                med.status === 'pending' &&
                                  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                med.status === 'cancelled' &&
                                  'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              )}
                            >
                              {med.status === 'completed' ? 'Completado' :
                               med.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                            </span>
                          </div>
                          <p className="text-xs text-surface-400 mt-2">
                            Prescrito: {formatDate(med.encounter_date)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabPanel>
          )}

          {/* Allergies Tab */}
          {activeTab === 'allergies' && (
            <TabPanel id="allergies">
              {patient.allergies ? (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          Alergias Registradas
                        </h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {patient.allergies}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-center text-surface-500 py-8 italic">
                  No hay alergias registradas para este paciente.
                </p>
              )}
            </TabPanel>
          )}

          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <TabPanel id="vitals">
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-surface-300 mx-auto mb-4" />
                <p className="text-surface-500 italic">
                  Los signos vitales se registran durante las consultas.
                </p>
                <p className="text-sm text-surface-400 mt-2">
                  Acceda a cada consulta para ver los signos vitales específicos.
                </p>
              </div>
            </TabPanel>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for displaying information
function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <div className="text-surface-400 mt-0.5">{icon}</div>}
      <div>
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-surface-900 dark:text-surface-50 mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
