'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Activity,
  FileText,
  AlertCircle,
  Clock,
  User,
  FileSignature,
  Plus,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  ShieldAlert,
  AlertTriangle,
  Stethoscope,
  Scale,
  Ruler,
  XCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Encounter {
  id: string;
  patient_id: string;
  doctor_id: string;
  encounter_type: string;
  status: string;
  reason: string | null;
  disposition: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  created_at: string;
  completed_at: string | null;
}

interface SOAPNote {
  id: string;
  encounter_id: string;
  note_type: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  signed: boolean;
  signed_at: string | null;
  created_at: string;
}

interface VitalSigns {
  id: string;
  encounter_id: string;
  patient_id: string;
  heart_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  recorded_at: string;
}

interface Diagnosis {
  id: string;
  encounter_id: string;
  patient_id: string;
  icd10_code: string;
  description: string;
  diagnosis_type: string;
  created_at: string;
}

interface Allergy {
  id: string;
  patient_id: string;
  allergen: string;
  reaction: string;
  severity: string;
  created_at: string;
}

// ─── Config ─────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<string, 'primary' | 'success' | 'default'> = {
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'default',
};

const typeLabels: Record<string, string> = {
  ambulatory: 'Ambulatorio',
  emergency: 'Emergencia',
  inpatient: 'Hospitalizacion',
};

const soapSections = [
  {
    key: 'subjective' as const,
    label: 'S - Subjetivo',
    description:
      'Motivo de consulta, sintomas referidos por el paciente, historia de la enfermedad actual',
    color: 'border-l-blue-400',
    placeholder: 'El paciente refiere...',
    rows: 5,
  },
  {
    key: 'objective' as const,
    label: 'O - Objetivo',
    description:
      'Hallazgos del examen fisico, signos vitales, resultados de laboratorio',
    color: 'border-l-green-400',
    placeholder: 'Al examen fisico se encuentra...',
    rows: 5,
  },
  {
    key: 'assessment' as const,
    label: 'A - Evaluacion',
    description:
      'Diagnosticos diferenciales, impresion diagnostica, codigos CIE-10',
    color: 'border-l-orange-400',
    placeholder: 'Diagnostico principal: ...',
    rows: 4,
  },
  {
    key: 'plan' as const,
    label: 'P - Plan',
    description:
      'Plan terapeutico, ordenes medicas, medicamentos, interconsultas, seguimiento',
    color: 'border-l-purple-400',
    placeholder:
      '1. Tratamiento farmacologico\n2. Estudios complementarios\n3. Seguimiento',
    rows: 5,
  },
];

const sections = [
  { id: 'soap', label: 'Nota SOAP', icon: FileText },
  { id: 'vitals', label: 'Signos Vitales', icon: Activity },
  { id: 'diagnoses', label: 'Diagnosticos', icon: Stethoscope },
  { id: 'allergies', label: 'Alergias', icon: ShieldAlert },
  { id: 'close', label: 'Cerrar Encuentro', icon: CheckCircle2 },
];

const severityLabels: Record<string, { label: string; variant: 'danger' | 'warning' | 'default' }> = {
  severe: { label: 'Severa', variant: 'danger' },
  moderate: { label: 'Moderada', variant: 'warning' },
  mild: { label: 'Leve', variant: 'default' },
};

// ─── Helpers ────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as { items: T[] }).items;
  }
  return [];
}

// ─── Page ───────────────────────────────────────────────

export default function EncounterDetailPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [activeSection, setActiveSection] = useState('soap');

  // ─── Data State ─────────────────────────────────────────
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [notes, setNotes] = useState<SOAPNote[]>([]);
  const [vitals, setVitals] = useState<VitalSigns[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);

  // ─── Loading / Error / Success ──────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── SOAP Form ──────────────────────────────────────────
  const [soapForm, setSoapForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [savingNote, setSavingNote] = useState(false);
  const [signingNote, setSigningNote] = useState(false);

  // ─── Vitals Form ────────────────────────────────────────
  const [vitalsForm, setVitalsForm] = useState({
    heart_rate: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    temperature: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    weight_kg: '',
    height_cm: '',
  });
  const [savingVitals, setSavingVitals] = useState(false);

  // ─── Diagnosis Form ─────────────────────────────────────
  const [diagForm, setDiagForm] = useState({
    icd10_code: '',
    description: '',
    diagnosis_type: 'principal',
  });
  const [savingDiag, setSavingDiag] = useState(false);

  // ─── Complete Encounter ─────────────────────────────────
  const [disposition, setDisposition] = useState('');
  const [completing, setCompleting] = useState(false);

  // ─── Computed ─────────────────────────────────────────
  const isReadOnly =
    encounter?.status === 'completed' || encounter?.status === 'cancelled';
  const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;
  const noteSigned = latestNote?.signed ?? false;

  // ─── Success Message Helper ─────────────────────────────
  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchEncounter = useCallback(async () => {
    try {
      const data = await api.get<Encounter>(`/emr/encounters/${encounterId}`);
      setEncounter(data);
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar el encuentro'
      );
      return null;
    }
  }, [encounterId]);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await api.get<SOAPNote[]>(
        `/emr/notes/encounter/${encounterId}`
      );
      setNotes(extractItems<SOAPNote>(data));
    } catch {
      setNotes([]);
    }
  }, [encounterId]);

  const fetchVitals = useCallback(async (patientId: string) => {
    try {
      const data = await api.get<VitalSigns[]>(
        `/emr/vitals/patient/${patientId}`
      );
      setVitals(extractItems<VitalSigns>(data));
    } catch {
      setVitals([]);
    }
  }, []);

  const fetchDiagnoses = useCallback(async (patientId: string) => {
    try {
      const data = await api.get<Diagnosis[]>(
        `/emr/patients/${patientId}/diagnoses`
      );
      setDiagnoses(extractItems<Diagnosis>(data));
    } catch {
      setDiagnoses([]);
    }
  }, []);

  const fetchAllergies = useCallback(async (patientId: string) => {
    try {
      const data = await api.get<Allergy[]>(
        `/emr/patients/${patientId}/allergies`
      );
      setAllergies(extractItems<Allergy>(data));
    } catch {
      setAllergies([]);
    }
  }, []);

  // ─── Initial Load ─────────────────────────────────────

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      const enc = await fetchEncounter();
      if (enc) {
        await Promise.all([
          fetchNotes(),
          fetchVitals(enc.patient_id),
          fetchDiagnoses(enc.patient_id),
          fetchAllergies(enc.patient_id),
        ]);
      }
      setLoading(false);
    }
    loadAll();
  }, [fetchEncounter, fetchNotes, fetchVitals, fetchDiagnoses, fetchAllergies]);

  // Populate SOAP form from latest note
  useEffect(() => {
    if (notes.length > 0) {
      const latest = notes[notes.length - 1];
      setSoapForm({
        subjective: latest.subjective || '',
        objective: latest.objective || '',
        assessment: latest.assessment || '',
        plan: latest.plan || '',
      });
    }
  }, [notes]);

  // ─── Actions ────────────────────────────────────────────

  const handleSaveNote = useCallback(async () => {
    if (!encounter) return;
    setSavingNote(true);
    setError(null);
    try {
      await api.post('/emr/notes', {
        encounter_id: encounter.id,
        note_type: 'soap',
        subjective: soapForm.subjective,
        objective: soapForm.objective,
        assessment: soapForm.assessment,
        plan: soapForm.plan,
      });
      await fetchNotes();
      showSuccess('Nota SOAP guardada exitosamente');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar la nota'
      );
    } finally {
      setSavingNote(false);
    }
  }, [encounter, soapForm, fetchNotes, showSuccess]);

  const handleSignNote = useCallback(async () => {
    if (!latestNote || latestNote.signed) return;
    setSigningNote(true);
    setError(null);
    try {
      await api.post(`/emr/notes/${latestNote.id}/sign`);
      await fetchNotes();
      showSuccess('Nota firmada exitosamente. La nota es ahora inmutable.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al firmar la nota'
      );
    } finally {
      setSigningNote(false);
    }
  }, [latestNote, fetchNotes, showSuccess]);

  const handleSaveVitals = useCallback(async () => {
    if (!encounter) return;
    setSavingVitals(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        encounter_id: encounter.id,
        patient_id: encounter.patient_id,
      };
      if (vitalsForm.heart_rate)
        body.heart_rate = parseFloat(vitalsForm.heart_rate);
      if (vitalsForm.blood_pressure_systolic)
        body.blood_pressure_systolic = parseFloat(
          vitalsForm.blood_pressure_systolic
        );
      if (vitalsForm.blood_pressure_diastolic)
        body.blood_pressure_diastolic = parseFloat(
          vitalsForm.blood_pressure_diastolic
        );
      if (vitalsForm.temperature)
        body.temperature = parseFloat(vitalsForm.temperature);
      if (vitalsForm.respiratory_rate)
        body.respiratory_rate = parseFloat(vitalsForm.respiratory_rate);
      if (vitalsForm.oxygen_saturation)
        body.oxygen_saturation = parseFloat(vitalsForm.oxygen_saturation);
      if (vitalsForm.weight_kg)
        body.weight_kg = parseFloat(vitalsForm.weight_kg);
      if (vitalsForm.height_cm)
        body.height_cm = parseFloat(vitalsForm.height_cm);

      await api.post('/emr/vitals', body);
      await fetchVitals(encounter.patient_id);
      setVitalsForm({
        heart_rate: '',
        blood_pressure_systolic: '',
        blood_pressure_diastolic: '',
        temperature: '',
        respiratory_rate: '',
        oxygen_saturation: '',
        weight_kg: '',
        height_cm: '',
      });
      showSuccess('Signos vitales registrados exitosamente');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al registrar signos vitales'
      );
    } finally {
      setSavingVitals(false);
    }
  }, [encounter, vitalsForm, fetchVitals, showSuccess]);

  const handleAddDiagnosis = useCallback(async () => {
    if (!encounter || !diagForm.icd10_code || !diagForm.description) return;
    setSavingDiag(true);
    setError(null);
    try {
      await api.post('/emr/diagnoses', {
        encounter_id: encounter.id,
        patient_id: encounter.patient_id,
        icd10_code: diagForm.icd10_code,
        description: diagForm.description,
        diagnosis_type: diagForm.diagnosis_type,
      });
      await fetchDiagnoses(encounter.patient_id);
      setDiagForm({ icd10_code: '', description: '', diagnosis_type: 'principal' });
      showSuccess('Diagnostico agregado exitosamente');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al agregar diagnostico'
      );
    } finally {
      setSavingDiag(false);
    }
  }, [encounter, diagForm, fetchDiagnoses, showSuccess]);

  const handleCompleteEncounter = useCallback(async () => {
    if (!encounter || !disposition) return;
    setCompleting(true);
    setError(null);
    try {
      await api.post(`/emr/encounters/${encounter.id}/complete`, {
        disposition,
      });
      await fetchEncounter();
      showSuccess('Encuentro completado exitosamente');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al completar el encuentro'
      );
    } finally {
      setCompleting(false);
    }
  }, [encounter, disposition, fetchEncounter, showSuccess]);

  // ─── Loading State ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-neutral-500">Cargando encuentro...</p>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-neutral-900">
          Encuentro no encontrado
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          {error || 'No se pudo cargar el encuentro solicitado.'}
        </p>
        <Link href="/emr">
          <Button variant="outline" size="sm" className="mt-4">
            Volver a encuentros
          </Button>
        </Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────

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

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700">{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

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
                  {encounter.patient_name || 'Paciente'}
                </h1>
                <Badge
                  variant={statusVariants[encounter.status] || 'default'}
                  dot
                  size="md"
                >
                  {statusLabels[encounter.status] || encounter.status}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500">
                <span className="font-mono">{encounter.patient_id}</span>
                <span className="mx-1.5">|</span>
                <span className="text-neutral-400">
                  <Clock className="w-3 h-3 inline" />{' '}
                  {formatDate(encounter.created_at)}
                </span>
                {encounter.completed_at && (
                  <>
                    <span className="mx-1.5">|</span>
                    <span className="text-green-600">
                      Completado: {formatDate(encounter.completed_at)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Allergies warning */}
          {allergies.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">
                Alergias:{' '}
                {allergies.map((a) => a.allergen).join(', ')}
              </span>
            </div>
          )}

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                onClick={handleSaveNote}
                disabled={savingNote}
              >
                {savingNote ? 'Guardando...' : 'Guardar Borrador'}
              </Button>
              <Button
                size="sm"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                variant="success"
                onClick={() => setActiveSection('close')}
              >
                Firmar y Cerrar
              </Button>
            </div>
          )}
        </div>

        {/* Encounter info */}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-neutral-500">Proveedor:</span>{' '}
            <span className="font-medium">
              {encounter.doctor_name || '---'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Tipo:</span>{' '}
            <Badge variant="primary" size="sm">
              {typeLabels[encounter.encounter_type] ||
                encounter.encounter_type}
            </Badge>
          </div>
          <div>
            <span className="text-neutral-500">Motivo:</span>{' '}
            <span className="font-medium">{encounter.reason || '---'}</span>
          </div>
          {encounter.disposition && (
            <div>
              <span className="text-neutral-500">Disposicion:</span>{' '}
              <span className="font-medium">{encounter.disposition}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 flex-wrap">
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
        {/* ── SOAP Note Section ────────────────────────── */}
        {activeSection === 'soap' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* SOAP Editor */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  title="Nota SOAP"
                  subtitle="Documentacion clinica estructurada"
                  action={
                    !isReadOnly && !noteSigned ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Save className="w-4 h-4" />}
                          onClick={handleSaveNote}
                          disabled={savingNote}
                        >
                          {savingNote ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          leftIcon={<FileSignature className="w-4 h-4" />}
                          onClick={handleSignNote}
                          disabled={signingNote || !latestNote}
                        >
                          {signingNote ? 'Firmando...' : 'Firmar Nota'}
                        </Button>
                      </div>
                    ) : noteSigned ? (
                      <Badge variant="success" dot size="md">
                        Nota Firmada
                      </Badge>
                    ) : undefined
                  }
                />

                <div className="space-y-5">
                  {soapSections.map((section) => (
                    <div
                      key={section.key}
                      className={`pl-4 border-l-4 ${section.color}`}
                    >
                      <label className="block text-sm font-semibold text-neutral-800 mb-0.5">
                        {section.label}
                      </label>
                      <p className="text-2xs text-neutral-400 mb-2">
                        {section.description}
                      </p>
                      <textarea
                        value={
                          soapForm[
                            section.key as keyof typeof soapForm
                          ]
                        }
                        onChange={(e) =>
                          setSoapForm((prev) => ({
                            ...prev,
                            [section.key]: e.target.value,
                          }))
                        }
                        rows={section.rows}
                        placeholder={section.placeholder}
                        readOnly={isReadOnly || noteSigned}
                        className="form-input resize-y text-sm leading-relaxed disabled:bg-neutral-50"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Side panel: Previous notes */}
            <div className="space-y-4">
              <Card>
                <CardHeader title="Historial de Notas" />
                {notes.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">
                    Aun no hay notas registradas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-neutral-500">
                            {formatDate(note.created_at)}
                          </span>
                          {note.signed ? (
                            <Badge variant="success" size="sm">
                              Firmada
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              Borrador
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-neutral-600 line-clamp-2">
                          S: {note.subjective?.slice(0, 80) || '---'}
                          {(note.subjective?.length || 0) > 80 ? '...' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── Vitals Section ──────────────────────────── */}
        {activeSection === 'vitals' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Vitals Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  title="Registro de Signos Vitales"
                  subtitle="Ingrese los signos vitales del paciente"
                  action={
                    !isReadOnly ? (
                      <Button
                        size="sm"
                        leftIcon={<Save className="w-4 h-4" />}
                        onClick={handleSaveVitals}
                        disabled={savingVitals}
                      >
                        {savingVitals ? 'Registrando...' : 'Registrar'}
                      </Button>
                    ) : undefined
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      key: 'blood_pressure_systolic',
                      label: 'PA Sistolica',
                      unit: 'mmHg',
                      icon: Activity,
                      placeholder: '120',
                    },
                    {
                      key: 'blood_pressure_diastolic',
                      label: 'PA Diastolica',
                      unit: 'mmHg',
                      icon: Activity,
                      placeholder: '80',
                    },
                    {
                      key: 'heart_rate',
                      label: 'Frec. Cardiaca',
                      unit: 'bpm',
                      icon: Heart,
                      placeholder: '72',
                    },
                    {
                      key: 'temperature',
                      label: 'Temperatura',
                      unit: 'C',
                      icon: Thermometer,
                      placeholder: '36.5',
                    },
                    {
                      key: 'respiratory_rate',
                      label: 'Frec. Respiratoria',
                      unit: 'rpm',
                      icon: Wind,
                      placeholder: '16',
                    },
                    {
                      key: 'oxygen_saturation',
                      label: 'SpO2',
                      unit: '%',
                      icon: Droplets,
                      placeholder: '98',
                    },
                    {
                      key: 'weight_kg',
                      label: 'Peso',
                      unit: 'kg',
                      icon: Scale,
                      placeholder: '70',
                    },
                    {
                      key: 'height_cm',
                      label: 'Talla',
                      unit: 'cm',
                      icon: Ruler,
                      placeholder: '170',
                    },
                  ].map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.key}>
                        <label className="form-label flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-neutral-400" />
                          {field.label}
                        </label>
                        <div className="flex">
                          <input
                            type="number"
                            step={
                              field.key === 'temperature' ? 0.1 : 1
                            }
                            value={
                              vitalsForm[
                                field.key as keyof typeof vitalsForm
                              ]
                            }
                            onChange={(e) =>
                              setVitalsForm((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            readOnly={isReadOnly}
                            className="form-input rounded-r-none flex-1"
                          />
                          <span className="px-3 py-2 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-lg text-xs text-neutral-500 flex items-center font-medium">
                            {field.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Vitals History */}
            <div>
              <Card>
                <CardHeader title="Historial de Signos Vitales" />
                {vitals.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">
                    Sin registros de signos vitales.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {vitals.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                      >
                        <p className="text-xs font-mono text-neutral-500 mb-2">
                          {formatDate(v.recorded_at)}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          {v.blood_pressure_systolic != null && (
                            <div>
                              <span className="text-neutral-400">PA:</span>{' '}
                              <span className="font-medium">
                                {v.blood_pressure_systolic}/
                                {v.blood_pressure_diastolic}
                              </span>
                            </div>
                          )}
                          {v.heart_rate != null && (
                            <div>
                              <span className="text-neutral-400">FC:</span>{' '}
                              <span className="font-medium">
                                {v.heart_rate} bpm
                              </span>
                            </div>
                          )}
                          {v.temperature != null && (
                            <div>
                              <span className="text-neutral-400">T:</span>{' '}
                              <span className="font-medium">
                                {v.temperature} C
                              </span>
                            </div>
                          )}
                          {v.respiratory_rate != null && (
                            <div>
                              <span className="text-neutral-400">FR:</span>{' '}
                              <span className="font-medium">
                                {v.respiratory_rate} rpm
                              </span>
                            </div>
                          )}
                          {v.oxygen_saturation != null && (
                            <div>
                              <span className="text-neutral-400">SpO2:</span>{' '}
                              <span className="font-medium">
                                {v.oxygen_saturation}%
                              </span>
                            </div>
                          )}
                          {v.weight_kg != null && (
                            <div>
                              <span className="text-neutral-400">Peso:</span>{' '}
                              <span className="font-medium">
                                {v.weight_kg} kg
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── Diagnoses Section ───────────────────────── */}
        {activeSection === 'diagnoses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Diagnosis List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  title="Diagnosticos (CIE-10)"
                  subtitle="Diagnosticos asociados a este paciente"
                />
                {diagnoses.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">
                    Sin diagnosticos registrados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {diagnoses.map((diag) => (
                      <div
                        key={diag.id}
                        className={`p-3 rounded-lg flex items-start justify-between ${
                          diag.diagnosis_type === 'principal'
                            ? 'bg-primary-50 border border-primary-200'
                            : 'bg-neutral-50 border border-neutral-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-xs font-bold ${
                                diag.diagnosis_type === 'principal'
                                  ? 'text-primary-700'
                                  : 'text-neutral-600'
                              }`}
                            >
                              {diag.icd10_code}
                            </span>
                            <Badge
                              variant={
                                diag.diagnosis_type === 'principal'
                                  ? 'primary'
                                  : 'default'
                              }
                              size="sm"
                            >
                              {diag.diagnosis_type === 'principal'
                                ? 'Principal'
                                : 'Secundario'}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-700 mt-0.5">
                            {diag.description}
                          </p>
                          <p className="text-2xs text-neutral-400 mt-1">
                            {formatDate(diag.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Add Diagnosis */}
            <div>
              <Card>
                <CardHeader title="Agregar Diagnostico" />
                {isReadOnly ? (
                  <p className="text-sm text-neutral-400 italic">
                    El encuentro esta cerrado. No se pueden agregar diagnosticos.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Input
                      label="Codigo CIE-10"
                      placeholder="Ej: I10"
                      value={diagForm.icd10_code}
                      onChange={(e) =>
                        setDiagForm((prev) => ({
                          ...prev,
                          icd10_code: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Descripcion"
                      placeholder="Descripcion del diagnostico"
                      value={diagForm.description}
                      onChange={(e) =>
                        setDiagForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                    <Select
                      label="Tipo"
                      options={[
                        { value: 'principal', label: 'Principal' },
                        { value: 'secundario', label: 'Secundario' },
                      ]}
                      value={diagForm.diagnosis_type}
                      onChange={(e) =>
                        setDiagForm((prev) => ({
                          ...prev,
                          diagnosis_type: e.target.value,
                        }))
                      }
                    />
                    <Button
                      className="w-full"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleAddDiagnosis}
                      disabled={
                        savingDiag ||
                        !diagForm.icd10_code ||
                        !diagForm.description
                      }
                    >
                      {savingDiag
                        ? 'Agregando...'
                        : 'Agregar Diagnostico'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── Allergies Section ───────────────────────── */}
        {activeSection === 'allergies' && (
          <Card>
            <CardHeader
              title="Alergias del Paciente"
              subtitle="Registro de alergias conocidas (solo lectura)"
            />
            {allergies.length === 0 ? (
              <div className="text-center py-8">
                <ShieldAlert className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">
                  No se han registrado alergias para este paciente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allergies.map((allergy) => {
                  const severity =
                    severityLabels[allergy.severity] ||
                    severityLabels['mild'] || { label: allergy.severity, variant: 'default' as const };
                  return (
                    <div
                      key={allergy.id}
                      className="p-4 rounded-lg border border-neutral-200 bg-white"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-neutral-900">
                          {allergy.allergen}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mb-2">
                        <span className="text-neutral-400">Reaccion:</span>{' '}
                        {allergy.reaction || '---'}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant={severity.variant} size="sm">
                          {severity.label}
                        </Badge>
                        <span className="text-2xs text-neutral-400">
                          {formatDate(allergy.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── Close Encounter Section ─────────────────── */}
        {activeSection === 'close' && (
          <Card>
            <CardHeader
              title="Cerrar Encuentro"
              subtitle="Complete el encuentro con una disposicion final"
            />
            {isReadOnly ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-lg font-semibold text-neutral-900">
                  Encuentro {statusLabels[encounter.status] || encounter.status}
                </p>
                {encounter.disposition && (
                  <p className="text-sm text-neutral-500 mt-1">
                    Disposicion: {encounter.disposition}
                  </p>
                )}
                {encounter.completed_at && (
                  <p className="text-sm text-neutral-400 mt-1">
                    Fecha de cierre: {formatDate(encounter.completed_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-md space-y-4">
                <Select
                  label="Disposicion"
                  required
                  options={[
                    { value: 'alta_medica', label: 'Alta Medica' },
                    { value: 'referido', label: 'Referido a Especialista' },
                    { value: 'hospitalizado', label: 'Hospitalizado' },
                    { value: 'observacion', label: 'En Observacion' },
                    { value: 'abandono', label: 'Abandono' },
                    { value: 'fallecido', label: 'Fallecido' },
                  ]}
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  placeholder="Seleccionar disposicion"
                />
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-700">
                    <strong>Atencion:</strong> Al completar el encuentro, la
                    documentacion clinica quedara cerrada. Asegurese de que
                    toda la informacion este correcta antes de continuar.
                  </p>
                </div>
                <Button
                  variant="success"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handleCompleteEncounter}
                  disabled={completing || !disposition}
                >
                  {completing
                    ? 'Completando...'
                    : 'Completar Encuentro'}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
