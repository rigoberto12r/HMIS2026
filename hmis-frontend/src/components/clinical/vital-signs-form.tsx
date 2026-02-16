'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseFloatSafe } from '@/lib/utils/safe-parse';
import { validateVitalSign } from '@/lib/utils/validation';
import { toast } from 'sonner';
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Scale,
  Ruler,
  AlertTriangle,
  Save,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface VitalSignsData {
  systolic: number;
  diastolic: number;
  heart_rate: number;
  temperature: number;
  respiratory_rate: number;
  oxygen_saturation: number;
  weight: number;
  height: number;
  pain_scale?: number;
  glucose?: number;
}

interface VitalFieldConfig {
  key: keyof VitalSignsData;
  label: string;
  unit: string;
  icon: React.ElementType;
  placeholder: string;
  normalRange: string;
  min?: number;
  max?: number;
  step?: number;
}

// ─── Field Configuration ────────────────────────────────

const vitalFields: VitalFieldConfig[] = [
  { key: 'systolic', label: 'PA Sistolica', unit: 'mmHg', icon: Activity, placeholder: '120', normalRange: '90-140', min: 60, max: 300 },
  { key: 'diastolic', label: 'PA Diastolica', unit: 'mmHg', icon: Activity, placeholder: '80', normalRange: '60-90', min: 30, max: 200 },
  { key: 'heart_rate', label: 'Frec. Cardiaca', unit: 'bpm', icon: Heart, placeholder: '72', normalRange: '60-100', min: 20, max: 250 },
  { key: 'temperature', label: 'Temperatura', unit: 'C', icon: Thermometer, placeholder: '36.5', normalRange: '36.1-37.2', step: 0.1, min: 30, max: 45 },
  { key: 'respiratory_rate', label: 'Frec. Respiratoria', unit: 'rpm', icon: Wind, placeholder: '16', normalRange: '12-20', min: 5, max: 60 },
  { key: 'oxygen_saturation', label: 'SpO2', unit: '%', icon: Droplets, placeholder: '98', normalRange: '95-100', min: 50, max: 100 },
  { key: 'weight', label: 'Peso', unit: 'kg', icon: Scale, placeholder: '70', normalRange: '---', step: 0.1, min: 0.5, max: 500 },
  { key: 'height', label: 'Talla', unit: 'cm', icon: Ruler, placeholder: '170', normalRange: '---', min: 20, max: 250 },
];

// ─── Helpers ────────────────────────────────────────────

function isAbnormal(key: string, value: number): boolean {
  const ranges: Record<string, [number, number]> = {
    systolic: [90, 140],
    diastolic: [60, 90],
    heart_rate: [60, 100],
    temperature: [36.1, 37.2],
    respiratory_rate: [12, 20],
    oxygen_saturation: [95, 100],
  };
  const range = ranges[key];
  if (!range) return false;
  return value < range[0] || value > range[1];
}

function calculateBMI(weight: number, height: number): string {
  if (!weight || !height) return '---';
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  return bmi.toFixed(1);
}

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Bajo peso', color: 'text-yellow-600' };
  if (bmi < 25) return { label: 'Normal', color: 'text-green-600' };
  if (bmi < 30) return { label: 'Sobrepeso', color: 'text-orange-600' };
  return { label: 'Obesidad', color: 'text-red-600' };
}

// ─── Component ──────────────────────────────────────────

interface VitalSignsFormProps {
  initialData?: Partial<VitalSignsData>;
  onSubmit?: (data: VitalSignsData) => void;
}

export function VitalSignsForm({ initialData, onSubmit }: VitalSignsFormProps) {
  const [vitals, setVitals] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    vitalFields.forEach((f) => {
      initial[f.key] = initialData?.[f.key]?.toString() || '';
    });
    initial.pain_scale = initialData?.pain_scale?.toString() || '';
    initial.glucose = initialData?.glucose?.toString() || '';
    return initial;
  });

  function handleChange(key: string, value: string) {
    setVitals((prev) => ({ ...prev, [key]: value }));

    // Validate vital signs ranges and show warnings
    if (value && value.trim() !== '') {
      const numValue = parseFloatSafe(value, 0, key);
      if (numValue > 0) {
        // Map keys to validation format
        const validationKey = key === 'systolic' ? 'systolic_bp' :
                             key === 'diastolic' ? 'diastolic_bp' :
                             key;

        const validation = validateVitalSign(validationKey as any, numValue);
        if (!validation.valid && validation.warning) {
          toast.warning(validation.warning, {
            duration: 4000,
            id: `vital-warning-${key}`, // Prevent duplicate toasts
          });
        }
      }
    }
  }

  const bmi = calculateBMI(
    parseFloatSafe(vitals.weight, 0, 'Weight'),
    parseFloatSafe(vitals.height, 0, 'Height')
  );
  const bmiNum = parseFloatSafe(bmi, 0, 'BMI');
  const bmiCategory = bmiNum > 0 ? getBMICategory(bmiNum) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Main form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="Registro de Signos Vitales"
            subtitle="Ingrese los signos vitales del paciente"
            action={
              <Button
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                onClick={() => {
                  const data: Record<string, number> = {};
                  Object.entries(vitals).forEach(([k, v]) => {
                    if (v) data[k] = parseFloatSafe(v, 0, k);
                  });
                  onSubmit?.(data as unknown as VitalSignsData);
                }}
              >
                Registrar
              </Button>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vitalFields.map((field) => {
              const Icon = field.icon;
              const value = vitals[field.key];
              const numValue = parseFloatSafe(value, 0, field.label);
              const abnormal = value && numValue > 0 && isAbnormal(field.key, numValue);

              return (
                <div key={field.key}>
                  <label className="form-label flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-neutral-400" />
                    {field.label}
                    {abnormal && (
                      <AlertTriangle className="w-3 h-3 text-medical-red" />
                    )}
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      step={field.step || 1}
                      min={field.min}
                      max={field.max}
                      value={value}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`form-input rounded-r-none flex-1 ${
                        abnormal ? 'border-medical-red focus:border-medical-red focus:ring-medical-red' : ''
                      }`}
                    />
                    <span className="px-3 py-2 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-lg text-xs text-neutral-500 flex items-center font-medium">
                      {field.unit}
                    </span>
                  </div>
                  <p className="text-2xs text-neutral-400 mt-0.5">
                    Normal: {field.normalRange}
                  </p>
                </div>
              );
            })}

            {/* Pain Scale */}
            <div>
              <label className="form-label">Escala de Dolor (EVA)</label>
              <div className="flex">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={vitals.pain_scale}
                  onChange={(e) => handleChange('pain_scale', e.target.value)}
                  placeholder="0"
                  className="form-input rounded-r-none flex-1"
                />
                <span className="px-3 py-2 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-lg text-xs text-neutral-500 flex items-center font-medium">
                  0-10
                </span>
              </div>
            </div>

            {/* Glucose */}
            <div>
              <label className="form-label">Glicemia Capilar</label>
              <div className="flex">
                <input
                  type="number"
                  min={20}
                  max={600}
                  value={vitals.glucose}
                  onChange={(e) => handleChange('glucose', e.target.value)}
                  placeholder="90"
                  className="form-input rounded-r-none flex-1"
                />
                <span className="px-3 py-2 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-lg text-xs text-neutral-500 flex items-center font-medium">
                  mg/dL
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Side panel: Current values summary */}
      <div className="space-y-4">
        <Card>
          <CardHeader title="Resumen" />
          <div className="grid grid-cols-2 gap-2">
            {vitalFields
              .filter((f) => vitals[f.key])
              .map((field) => {
                const value = parseFloatSafe(vitals[field.key], 0, field.label);
                const abnormal = value > 0 && isAbnormal(field.key, value);
                return (
                  <div
                    key={field.key}
                    className={`rounded-lg p-2.5 text-center ${
                      abnormal ? 'bg-red-50 border border-red-200' : 'bg-neutral-50'
                    }`}
                  >
                    <p className="text-2xs text-neutral-500 mb-0.5">{field.label}</p>
                    <p
                      className={`text-sm font-bold ${
                        abnormal ? 'text-medical-red' : 'text-neutral-900'
                      }`}
                    >
                      {vitals[field.key]} <span className="text-2xs font-normal text-neutral-400">{field.unit}</span>
                    </p>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* BMI Card */}
        {vitals.weight && vitals.height && (
          <Card>
            <CardHeader title="Indice de Masa Corporal" />
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-neutral-900">{bmi}</p>
              <p className="text-sm text-neutral-500 mt-0.5">kg/m2</p>
              {bmiCategory && (
                <Badge
                  variant={bmiCategory.label === 'Normal' ? 'success' : 'warning'}
                  className="mt-2"
                >
                  {bmiCategory.label}
                </Badge>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
