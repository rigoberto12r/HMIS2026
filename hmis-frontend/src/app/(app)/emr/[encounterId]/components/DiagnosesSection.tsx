/**
 * DiagnosesSection Component
 * Displays patient diagnoses (ICD-10) with form to add new ones
 */

import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { Diagnosis, DiagnosisFormData } from '../types';

interface DiagnosesSectionProps {
  diagnoses: Diagnosis[];
  form: DiagnosisFormData;
  isReadOnly: boolean;
  savingDiag: boolean;
  onChange: (data: DiagnosisFormData) => void;
  onAdd: () => void;
}

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

export function DiagnosesSection({
  diagnoses,
  form,
  isReadOnly,
  savingDiag,
  onChange,
  onAdd,
}: DiagnosesSectionProps) {
  return (
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
                value={form.icd10_code}
                onChange={(e) =>
                  onChange({
                    ...form,
                    icd10_code: e.target.value,
                  })
                }
              />
              <Input
                label="Descripcion"
                placeholder="Descripcion del diagnostico"
                value={form.description}
                onChange={(e) =>
                  onChange({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
              <Select
                label="Tipo"
                options={[
                  { value: 'principal', label: 'Principal' },
                  { value: 'secundario', label: 'Secundario' },
                ]}
                value={form.diagnosis_type}
                onChange={(e) =>
                  onChange({
                    ...form,
                    diagnosis_type: e.target.value,
                  })
                }
              />
              <Button
                className="w-full"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={onAdd}
                disabled={
                  savingDiag ||
                  !form.icd10_code ||
                  !form.description
                }
              >
                {savingDiag ? 'Agregando...' : 'Agregar Diagnostico'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
