'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  FileSignature,
  Plus,
  X,
  ClipboardList,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface Diagnosis {
  code: string;
  description: string;
  type: 'principal' | 'secundario';
}

// ─── SOAP Note Section Config ───────────────────────────

const soapSections = [
  {
    key: 'subjective' as const,
    label: 'S - Subjetivo',
    description: 'Motivo de consulta, sintomas referidos por el paciente, historia de la enfermedad actual',
    color: 'border-l-blue-400',
    placeholder: 'El paciente refiere...',
    rows: 5,
  },
  {
    key: 'objective' as const,
    label: 'O - Objetivo',
    description: 'Hallazgos del examen fisico, signos vitales, resultados de laboratorio',
    color: 'border-l-green-400',
    placeholder: 'Al examen fisico se encuentra...',
    rows: 5,
  },
  {
    key: 'assessment' as const,
    label: 'A - Evaluacion',
    description: 'Diagnosticos diferenciales, impresion diagnostica, codigos CIE-10',
    color: 'border-l-orange-400',
    placeholder: 'Diagnostico principal: ...',
    rows: 4,
  },
  {
    key: 'plan' as const,
    label: 'P - Plan',
    description: 'Plan terapeutico, ordenes medicas, medicamentos, interconsultas, seguimiento',
    color: 'border-l-purple-400',
    placeholder: '1. Tratamiento farmacologico\n2. Estudios complementarios\n3. Seguimiento',
    rows: 5,
  },
];

// ─── Component ──────────────────────────────────────────

interface SOAPNoteEditorProps {
  initialNote?: SOAPNote;
  onSave?: (note: SOAPNote) => void;
  onSign?: (note: SOAPNote) => void;
  readOnly?: boolean;
}

export function SOAPNoteEditor({ initialNote, onSave, onSign, readOnly = false }: SOAPNoteEditorProps) {
  const [note, setNote] = useState<SOAPNote>(
    initialNote || {
      subjective:
        'Paciente femenina de 35 anos acude para control de hipertension arterial. Refiere cumplimiento del tratamiento con Losartan 50mg diario. Niega cefalea, mareos o palpitaciones. Refiere leve edema en miembros inferiores al final del dia.',
      objective:
        'PA: 140/90 mmHg, FC: 78 bpm, T: 36.5 C, SpO2: 98%, Peso: 68 kg.\nAlerta, orientada, buen estado general.\nCuello: no ingurgitacion yugular.\nTorax: ruidos cardiacos ritmicos, sin soplos. Murmullo vesicular conservado.\nAbdomen: blando, no doloroso.\nExtremidades: leve edema pretibial bilateral (+/4).',
      assessment:
        'Hipertension arterial esencial no controlada (I10).\nEdema periferico leve a estudiar.',
      plan: '1. Ajustar Losartan a 100mg c/24h\n2. Agregar Hidroclorotiazida 25mg c/24h\n3. Solicitar: perfil lipidico, funcion renal, electrolitos, EKG\n4. Dieta hiposodica, actividad fisica 30 min/dia\n5. Monitoreo de PA domiciliario\n6. Control en 4 semanas con resultados',
    }
  );

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([
    { code: 'I10', description: 'Hipertension esencial (primaria)', type: 'principal' },
    { code: 'R60.0', description: 'Edema localizado', type: 'secundario' },
  ]);

  const [newDiagCode, setNewDiagCode] = useState('');
  const [newDiagDesc, setNewDiagDesc] = useState('');

  function updateNote(key: keyof SOAPNote, value: string) {
    setNote((prev) => ({ ...prev, [key]: value }));
  }

  function addDiagnosis() {
    if (newDiagCode && newDiagDesc) {
      setDiagnoses((prev) => [
        ...prev,
        { code: newDiagCode, description: newDiagDesc, type: 'secundario' },
      ]);
      setNewDiagCode('');
      setNewDiagDesc('');
    }
  }

  function removeDiagnosis(index: number) {
    setDiagnoses((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* SOAP Editor (main area) */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader
            title="Nota SOAP"
            subtitle="Documentacion clinica estructurada"
            action={
              !readOnly ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Save className="w-4 h-4" />}
                    onClick={() => onSave?.(note)}
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    leftIcon={<FileSignature className="w-4 h-4" />}
                    onClick={() => onSign?.(note)}
                  >
                    Firmar Nota
                  </Button>
                </div>
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
                <p className="text-2xs text-neutral-400 mb-2">{section.description}</p>
                <textarea
                  value={note[section.key]}
                  onChange={(e) => updateNote(section.key, e.target.value)}
                  rows={section.rows}
                  placeholder={section.placeholder}
                  readOnly={readOnly}
                  className="form-input resize-y text-sm leading-relaxed disabled:bg-neutral-50"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Side Panel */}
      <div className="space-y-4">
        {/* Diagnoses */}
        <Card>
          <CardHeader title="Diagnosticos (CIE-10)" />
          <div className="space-y-2 mb-4">
            {diagnoses.map((diag, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg flex items-start justify-between ${
                  diag.type === 'principal'
                    ? 'bg-primary-50 border border-primary-200'
                    : 'bg-neutral-50 border border-neutral-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${
                        diag.type === 'principal' ? 'text-primary-700' : 'text-neutral-600'
                      }`}
                    >
                      {diag.code}
                    </span>
                    <Badge
                      variant={diag.type === 'principal' ? 'primary' : 'default'}
                      size="sm"
                    >
                      {diag.type === 'principal' ? 'Principal' : 'Secundario'}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-700 mt-0.5">{diag.description}</p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeDiagnosis(idx)}
                    className="text-neutral-400 hover:text-red-500 p-1"
                    aria-label="Eliminar diagnostico"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add diagnosis */}
          {!readOnly && (
            <div className="space-y-2 pt-3 border-t border-neutral-100">
              <div className="flex gap-2">
                <Input
                  placeholder="CIE-10"
                  value={newDiagCode}
                  onChange={(e) => setNewDiagCode(e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Descripcion del diagnostico"
                  value={newDiagDesc}
                  onChange={(e) => setNewDiagDesc(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={addDiagnosis}
                disabled={!newDiagCode || !newDiagDesc}
              >
                Agregar Diagnostico
              </Button>
            </div>
          )}
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader title="Ordenes Medicas" />
          <div className="space-y-2">
            {[
              { type: 'Laboratorio', desc: 'Perfil lipidico, funcion renal, electrolitos' },
              { type: 'Estudio', desc: 'Electrocardiograma (EKG)' },
            ].map((order, idx) => (
              <div key={idx} className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-3.5 h-3.5 text-secondary-500" />
                  <Badge variant="secondary" size="sm">
                    {order.type}
                  </Badge>
                </div>
                <p className="text-sm text-neutral-700">{order.desc}</p>
              </div>
            ))}
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nueva Orden
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
