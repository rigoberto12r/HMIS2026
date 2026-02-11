/**
 * AllergiesSection Component
 * Displays patient allergies (read-only)
 */

import { ShieldAlert, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Allergy } from '../types';

interface AllergiesSectionProps {
  allergies: Allergy[];
}

const severityLabels: Record<string, { label: string; variant: 'danger' | 'warning' | 'default' }> = {
  severe: { label: 'Severa', variant: 'danger' },
  moderate: { label: 'Moderada', variant: 'warning' },
  mild: { label: 'Leve', variant: 'default' },
};

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

export function AllergiesSection({ allergies }: AllergiesSectionProps) {
  return (
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
  );
}
