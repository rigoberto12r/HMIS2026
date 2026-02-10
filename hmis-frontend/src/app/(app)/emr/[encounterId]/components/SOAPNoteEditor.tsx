/**
 * SOAPNoteEditor Component
 * SOAP (Subjective, Objective, Assessment, Plan) clinical note editor
 */

import { Save, FileSignature } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SOAPNote, SOAPFormData } from '../types';

interface SOAPNoteEditorProps {
  form: SOAPFormData;
  notes: SOAPNote[];
  isReadOnly: boolean;
  noteSigned: boolean;
  savingNote: boolean;
  signingNote: boolean;
  latestNote: SOAPNote | null;
  onChange: (data: SOAPFormData) => void;
  onSave: () => void;
  onSign: () => void;
}

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

export function SOAPNoteEditor({
  form,
  notes,
  isReadOnly,
  noteSigned,
  savingNote,
  signingNote,
  latestNote,
  onChange,
  onSave,
  onSign,
}: SOAPNoteEditorProps) {
  return (
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
                    onClick={onSave}
                    disabled={savingNote}
                  >
                    {savingNote ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    leftIcon={<FileSignature className="w-4 h-4" />}
                    onClick={onSign}
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
                  value={form[section.key]}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      [section.key]: e.target.value,
                    })
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
  );
}
