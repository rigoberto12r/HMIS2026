/**
 * ClinicalHistoryTab Component
 * Displays patient allergies and diagnoses
 */

import { AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import type { Allergy, Diagnosis } from '@/hooks/usePatientDetail';

interface Props {
  allergies: Allergy[];
  diagnoses: Diagnosis[];
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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

export function ClinicalHistoryTab({ allergies, diagnoses, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
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
                {diagnosis.notes && <p className="text-sm text-neutral-600">{diagnosis.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
