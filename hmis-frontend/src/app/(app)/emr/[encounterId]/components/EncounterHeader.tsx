/**
 * EncounterHeader Component
 * Displays encounter information, patient details, and allergies warning
 */

import { Clock, User, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Encounter, Allergy } from '../types';

interface EncounterHeaderProps {
  encounter: Encounter;
  allergies: Allergy[];
  isReadOnly: boolean;
  savingNote: boolean;
  onSaveNote: () => void;
  onCloseEncounter: () => void;
}

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

export function EncounterHeader({
  encounter,
  allergies,
  isReadOnly,
  savingNote,
  onSaveNote,
  onCloseEncounter,
}: EncounterHeaderProps) {
  return (
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
                Encuentro Clinico
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
                {formatDate(encounter.start_datetime)}
              </span>
              {encounter.end_datetime && (
                <>
                  <span className="mx-1.5">|</span>
                  <span className="text-green-600">
                    Completado: {formatDate(encounter.end_datetime)}
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
              Alergias: {allergies.map((a) => a.allergen).join(', ')}
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
              onClick={onSaveNote}
              disabled={savingNote}
            >
              {savingNote ? 'Guardando...' : 'Guardar Borrador'}
            </Button>
            <Button
              size="sm"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              variant="success"
              onClick={onCloseEncounter}
            >
              Firmar y Cerrar
            </Button>
          </div>
        )}
      </div>

      {/* Encounter info */}
      <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-neutral-500">Tipo:</span>{' '}
          <Badge variant="primary" size="sm">
            {typeLabels[encounter.encounter_type] || encounter.encounter_type}
          </Badge>
        </div>
        <div>
          <span className="text-neutral-500">Motivo:</span>{' '}
          <span className="font-medium">{encounter.chief_complaint || '---'}</span>
        </div>
        {encounter.disposition && (
          <div>
            <span className="text-neutral-500">Disposicion:</span>{' '}
            <span className="font-medium">{encounter.disposition}</span>
          </div>
        )}
      </div>
    </div>
  );
}
