'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useMedRecByEncounter,
  useStartMedRec,
  useUpdateHomeMeds,
  useCompleteMedRec,
  type HomeMedication,
  type MedicationDecision,
  type NewMedicationEntry,
} from '@/hooks/useMedRec';

const STEPS = [
  'Medicamentos del Hogar',
  'Revisar Prescripciones',
  'Nuevos Medicamentos',
  'Confirmar',
] as const;

const ROUTES = ['oral', 'IV', 'IM', 'topico', 'sublingual', 'inhalado'] as const;
const REC_TYPES = ['admission', 'transfer', 'discharge'] as const;

export default function MedRecPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = params.encounterId as string;

  const [step, setStep] = useState(0);
  const [recType, setRecType] = useState<'admission' | 'transfer' | 'discharge'>('admission');
  const [patientId, setPatientId] = useState('');

  // Home medications state
  const [homeMeds, setHomeMeds] = useState<HomeMedication[]>([]);
  const [newHomeMed, setNewHomeMed] = useState<HomeMedication>({
    name: '', dose: '', frequency: '', route: 'oral', source: 'patient',
  });

  // Decisions state
  const [decisions, setDecisions] = useState<MedicationDecision[]>([]);

  // New medications state
  const [newMeds, setNewMeds] = useState<NewMedicationEntry[]>([]);
  const [newMedEntry, setNewMedEntry] = useState<NewMedicationEntry>({
    medication_name: '', dosage: '', frequency: '', route: 'oral',
  });

  const [notes, setNotes] = useState('');

  // Queries
  const { data: existingRec, isLoading } = useMedRecByEncounter(encounterId);
  const startMedRec = useStartMedRec();
  const updateHomeMeds = useUpdateHomeMeds();
  const completeMedRec = useCompleteMedRec();

  // If there's an existing completed reconciliation, show read-only view
  if (existingRec && existingRec.status === 'completed') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <Card>
          <CardHeader
            title="Reconciliacion Completada"
            subtitle={`Tipo: ${existingRec.reconciliation_type}`}
            action={<Badge variant="success">Completada</Badge>}
          />
          <CardContent>
            <div className="space-y-4">
              {existingRec.home_medications && existingRec.home_medications.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 mb-2">Medicamentos del Hogar</h4>
                  <ul className="text-sm space-y-1">
                    {existingRec.home_medications.map((m, i) => (
                      <li key={i} className="text-neutral-600">
                        {m.name} {m.dose && `- ${m.dose}`} {m.frequency && `(${m.frequency})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {existingRec.continue_medications && existingRec.continue_medications.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Continuados</h4>
                  <ul className="text-sm space-y-1">
                    {existingRec.continue_medications.map((m, i) => (
                      <li key={i} className="text-neutral-600">
                        {(m as Record<string, string>).medication_name} - {(m as Record<string, string>).dosage}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {existingRec.discontinue_medications && existingRec.discontinue_medications.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2">Descontinuados</h4>
                  <ul className="text-sm space-y-1">
                    {existingRec.discontinue_medications.map((m, i) => (
                      <li key={i} className="text-neutral-600">
                        {(m as Record<string, string>).medication_name} — {(m as Record<string, string>).reason || 'Sin razon'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {existingRec.notes && (
                <div>
                  <h4 className="font-medium text-neutral-700 mb-1">Notas</h4>
                  <p className="text-sm text-neutral-600">{existingRec.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no existing rec, show start or wizard
  const medRecId = existingRec?.id;

  const handleStart = async () => {
    if (!patientId) return;
    await startMedRec.mutateAsync({
      encounter_id: encounterId,
      patient_id: patientId,
      reconciliation_type: recType,
      home_medications: homeMeds,
    });
    setStep(1);
  };

  const addHomeMed = () => {
    if (!newHomeMed.name) return;
    setHomeMeds([...homeMeds, { ...newHomeMed }]);
    setNewHomeMed({ name: '', dose: '', frequency: '', route: 'oral', source: 'patient' });
  };

  const removeHomeMed = (idx: number) => {
    setHomeMeds(homeMeds.filter((_, i) => i !== idx));
  };

  const handleDecision = (prescriptionId: string, action: 'continue' | 'discontinue', reason?: string) => {
    setDecisions(prev => {
      const without = prev.filter(d => d.prescription_id !== prescriptionId);
      return [...without, { prescription_id: prescriptionId, action, reason }];
    });
  };

  const addNewMed = () => {
    if (!newMedEntry.medication_name || !newMedEntry.dosage || !newMedEntry.frequency) return;
    setNewMeds([...newMeds, { ...newMedEntry }]);
    setNewMedEntry({ medication_name: '', dosage: '', frequency: '', route: 'oral' });
  };

  const removeNewMed = (idx: number) => {
    setNewMeds(newMeds.filter((_, i) => i !== idx));
  };

  const handleComplete = async () => {
    if (!medRecId) return;
    await completeMedRec.mutateAsync({
      medRecId,
      data: { decisions, new_medications: newMeds, notes: notes || undefined },
    });
    router.push(`/emr/${encounterId}`);
  };

  if (isLoading) {
    return <div className="p-6 text-neutral-500">Cargando...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => (medRecId || i === 0) && setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                i === step
                  ? 'bg-primary-500 text-white'
                  : i < step
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-white/20">
                {i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-0.5 bg-neutral-200" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Home Medications + Start */}
      {step === 0 && !medRecId && (
        <Card>
          <CardHeader
            title="Iniciar Reconciliacion"
            subtitle="Capture los medicamentos que el paciente reporta tomar en casa"
          />
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    ID del Paciente
                  </label>
                  <Input
                    value={patientId}
                    onChange={e => setPatientId(e.target.value)}
                    placeholder="UUID del paciente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Tipo de Reconciliacion
                  </label>
                  <select
                    value={recType}
                    onChange={e => setRecType(e.target.value as typeof recType)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {REC_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t === 'admission' ? 'Admision' : t === 'transfer' ? 'Transferencia' : 'Alta'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-700 mb-3">Medicamentos del Hogar</h4>
                {homeMeds.map((med, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-neutral-50 rounded">
                    <span className="flex-1 text-sm">
                      {med.name} {med.dose && `- ${med.dose}`} {med.frequency && `(${med.frequency})`}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => removeHomeMed(idx)}>
                      Eliminar
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-2 mt-2">
                  <Input
                    placeholder="Nombre"
                    value={newHomeMed.name}
                    onChange={e => setNewHomeMed({ ...newHomeMed, name: e.target.value })}
                  />
                  <Input
                    placeholder="Dosis"
                    value={newHomeMed.dose || ''}
                    onChange={e => setNewHomeMed({ ...newHomeMed, dose: e.target.value })}
                  />
                  <Input
                    placeholder="Frecuencia"
                    value={newHomeMed.frequency || ''}
                    onChange={e => setNewHomeMed({ ...newHomeMed, frequency: e.target.value })}
                  />
                  <select
                    value={newHomeMed.route || 'oral'}
                    onChange={e => setNewHomeMed({ ...newHomeMed, route: e.target.value })}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {ROUTES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <Button onClick={addHomeMed} disabled={!newHomeMed.name}>
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleStart}
              disabled={!patientId || startMedRec.isPending}
            >
              {startMedRec.isPending ? 'Iniciando...' : 'Iniciar Reconciliacion'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 0 when rec already exists: show home meds editor */}
      {step === 0 && medRecId && (
        <Card>
          <CardHeader
            title="Medicamentos del Hogar"
            subtitle="Actualice la lista de medicamentos que el paciente toma en casa"
          />
          <CardContent>
            {homeMeds.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-neutral-50 rounded">
                <span className="flex-1 text-sm">
                  {med.name} {med.dose && `- ${med.dose}`} {med.frequency && `(${med.frequency})`}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeHomeMed(idx)}>
                  Eliminar
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-5 gap-2 mt-2">
              <Input
                placeholder="Nombre"
                value={newHomeMed.name}
                onChange={e => setNewHomeMed({ ...newHomeMed, name: e.target.value })}
              />
              <Input
                placeholder="Dosis"
                value={newHomeMed.dose || ''}
                onChange={e => setNewHomeMed({ ...newHomeMed, dose: e.target.value })}
              />
              <Input
                placeholder="Frecuencia"
                value={newHomeMed.frequency || ''}
                onChange={e => setNewHomeMed({ ...newHomeMed, frequency: e.target.value })}
              />
              <select
                value={newHomeMed.route || 'oral'}
                onChange={e => setNewHomeMed({ ...newHomeMed, route: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {ROUTES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button onClick={addHomeMed} disabled={!newHomeMed.name}>
                Agregar
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setStep(1)}>Siguiente</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Review Prescriptions */}
      {step === 1 && (
        <Card>
          <CardHeader
            title="Revisar Prescripciones Activas"
            subtitle="Decida si continuar o descontinuar cada prescripcion activa"
          />
          <CardContent>
            {existingRec?.continue_medications && existingRec.continue_medications.length > 0 ? (
              <div className="space-y-3">
                {existingRec.continue_medications.map((med, idx) => {
                  const rxId = (med as Record<string, string>).prescription_id;
                  const current = decisions.find(d => d.prescription_id === rxId);
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">
                          {(med as Record<string, string>).medication_name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {(med as Record<string, string>).dosage} - {(med as Record<string, string>).frequency}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={current?.action === 'continue' ? 'primary' : 'outline'}
                          onClick={() => handleDecision(rxId, 'continue')}
                        >
                          Continuar
                        </Button>
                        <Button
                          size="sm"
                          variant={current?.action === 'discontinue' ? 'danger' : 'outline'}
                          onClick={() => handleDecision(rxId, 'discontinue', 'Clinicamente indicado')}
                        >
                          Descontinuar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">No hay prescripciones activas para revisar.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setStep(0)}>Atras</Button>
            <Button onClick={() => setStep(2)}>Siguiente</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: New Medications */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="Nuevos Medicamentos"
            subtitle="Agregue medicamentos nuevos que se necesiten durante esta transicion"
          />
          <CardContent>
            {newMeds.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-neutral-50 rounded">
                <span className="flex-1 text-sm">
                  {med.medication_name} - {med.dosage} ({med.frequency}, {med.route})
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeNewMed(idx)}>
                  Eliminar
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-5 gap-2 mt-3">
              <Input
                placeholder="Medicamento"
                value={newMedEntry.medication_name}
                onChange={e => setNewMedEntry({ ...newMedEntry, medication_name: e.target.value })}
              />
              <Input
                placeholder="Dosis"
                value={newMedEntry.dosage}
                onChange={e => setNewMedEntry({ ...newMedEntry, dosage: e.target.value })}
              />
              <Input
                placeholder="Frecuencia"
                value={newMedEntry.frequency}
                onChange={e => setNewMedEntry({ ...newMedEntry, frequency: e.target.value })}
              />
              <select
                value={newMedEntry.route}
                onChange={e => setNewMedEntry({ ...newMedEntry, route: e.target.value })}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {ROUTES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button
                onClick={addNewMed}
                disabled={!newMedEntry.medication_name || !newMedEntry.dosage || !newMedEntry.frequency}
              >
                Agregar
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setStep(1)}>Atras</Button>
            <Button onClick={() => setStep(3)}>Siguiente</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader
            title="Confirmar Reconciliacion"
            subtitle="Revise todos los cambios antes de completar"
          />
          <CardContent>
            <div className="space-y-4">
              {homeMeds.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 mb-2">
                    Medicamentos del Hogar ({homeMeds.length})
                  </h4>
                  <ul className="text-sm space-y-1 text-neutral-600">
                    {homeMeds.map((m, i) => (
                      <li key={i}>{m.name} {m.dose && `- ${m.dose}`}</li>
                    ))}
                  </ul>
                </div>
              )}

              {decisions.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 mb-2">
                    Decisiones ({decisions.length})
                  </h4>
                  <ul className="text-sm space-y-1">
                    {decisions.map((d, i) => (
                      <li key={i} className={d.action === 'continue' ? 'text-green-700' : 'text-red-700'}>
                        {d.action === 'continue' ? 'Continuar' : 'Descontinuar'}: {d.prescription_id.slice(0, 8)}...
                        {d.reason && ` — ${d.reason}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {newMeds.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-700 mb-2">
                    Nuevos Medicamentos ({newMeds.length})
                  </h4>
                  <ul className="text-sm space-y-1 text-blue-700">
                    {newMeds.map((m, i) => (
                      <li key={i}>{m.medication_name} - {m.dosage} ({m.frequency})</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Notas adicionales sobre la reconciliacion..."
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setStep(2)}>Atras</Button>
            <Button
              onClick={handleComplete}
              disabled={completeMedRec.isPending}
            >
              {completeMedRec.isPending ? 'Completando...' : 'Completar Reconciliacion'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
