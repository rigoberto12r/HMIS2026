/**
 * VitalsEditor Component
 * Form for recording and displaying patient vital signs
 */

import { Save, Heart, Thermometer, Wind, Droplets, Activity, Scale, Ruler } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { VitalSigns, VitalsFormData } from '../types';

interface VitalsEditorProps {
  form: VitalsFormData;
  vitals: VitalSigns[];
  isReadOnly: boolean;
  savingVitals: boolean;
  onChange: (data: VitalsFormData) => void;
  onSave: () => void;
}

const vitalsFields = [
  {
    key: 'blood_pressure_systolic' as const,
    label: 'PA Sistolica',
    unit: 'mmHg',
    icon: Activity,
    placeholder: '120',
    step: 1,
  },
  {
    key: 'blood_pressure_diastolic' as const,
    label: 'PA Diastolica',
    unit: 'mmHg',
    icon: Activity,
    placeholder: '80',
    step: 1,
  },
  {
    key: 'heart_rate' as const,
    label: 'Frec. Cardiaca',
    unit: 'bpm',
    icon: Heart,
    placeholder: '72',
    step: 1,
  },
  {
    key: 'temperature' as const,
    label: 'Temperatura',
    unit: 'C',
    icon: Thermometer,
    placeholder: '36.5',
    step: 0.1,
  },
  {
    key: 'respiratory_rate' as const,
    label: 'Frec. Respiratoria',
    unit: 'rpm',
    icon: Wind,
    placeholder: '16',
    step: 1,
  },
  {
    key: 'oxygen_saturation' as const,
    label: 'SpO2',
    unit: '%',
    icon: Droplets,
    placeholder: '98',
    step: 1,
  },
  {
    key: 'weight_kg' as const,
    label: 'Peso',
    unit: 'kg',
    icon: Scale,
    placeholder: '70',
    step: 1,
  },
  {
    key: 'height_cm' as const,
    label: 'Talla',
    unit: 'cm',
    icon: Ruler,
    placeholder: '170',
    step: 1,
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

export function VitalsEditor({
  form,
  vitals,
  isReadOnly,
  savingVitals,
  onChange,
  onSave,
}: VitalsEditorProps) {
  return (
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
                  onClick={onSave}
                  disabled={savingVitals}
                >
                  {savingVitals ? 'Registrando...' : 'Registrar'}
                </Button>
              ) : undefined
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vitalsFields.map((field) => {
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
                      step={field.step}
                      value={form[field.key]}
                      onChange={(e) =>
                        onChange({
                          ...form,
                          [field.key]: e.target.value,
                        })
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
                          {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}
                        </span>
                      </div>
                    )}
                    {v.heart_rate != null && (
                      <div>
                        <span className="text-neutral-400">FC:</span>{' '}
                        <span className="font-medium">{v.heart_rate} bpm</span>
                      </div>
                    )}
                    {v.temperature != null && (
                      <div>
                        <span className="text-neutral-400">T:</span>{' '}
                        <span className="font-medium">{v.temperature} C</span>
                      </div>
                    )}
                    {v.respiratory_rate != null && (
                      <div>
                        <span className="text-neutral-400">FR:</span>{' '}
                        <span className="font-medium">{v.respiratory_rate} rpm</span>
                      </div>
                    )}
                    {v.oxygen_saturation != null && (
                      <div>
                        <span className="text-neutral-400">SpO2:</span>{' '}
                        <span className="font-medium">{v.oxygen_saturation}%</span>
                      </div>
                    )}
                    {v.weight_kg != null && (
                      <div>
                        <span className="text-neutral-400">Peso:</span>{' '}
                        <span className="font-medium">{v.weight_kg} kg</span>
                      </div>
                    )}
                    {v.height_cm != null && (
                      <div>
                        <span className="text-neutral-400">Talla:</span>{' '}
                        <span className="font-medium">{v.height_cm} cm</span>
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
  );
}
