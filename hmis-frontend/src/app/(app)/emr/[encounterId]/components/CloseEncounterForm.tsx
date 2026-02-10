/**
 * CloseEncounterForm Component
 * Form to complete an encounter with final disposition
 */

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import type { Encounter } from '../types';

interface CloseEncounterFormProps {
  encounter: Encounter;
  disposition: string;
  completing: boolean;
  isReadOnly: boolean;
  noteSigned: boolean;
  onDispositionChange: (value: string) => void;
  onComplete: () => void;
}

const statusLabels: Record<string, string> = {
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
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

export function CloseEncounterForm({
  encounter,
  disposition,
  completing,
  isReadOnly,
  noteSigned,
  onDispositionChange,
  onComplete,
}: CloseEncounterFormProps) {
  return (
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
            onChange={(e) => onDispositionChange(e.target.value)}
            placeholder="Seleccionar disposicion"
          />
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-700">
              <strong>Importante:</strong> Al cerrar el encuentro:
            </p>
            <ul className="text-xs text-yellow-700 mt-1.5 ml-4 space-y-1 list-disc">
              <li>Se marcara como completado y no se podra modificar</li>
              <li>La nota SOAP debe estar firmada antes de continuar</li>
              <li>Todos los datos quedaran bloqueados para edicion</li>
            </ul>
          </div>
          {!noteSigned && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                La nota SOAP debe estar firmada antes de cerrar el encuentro.
                Vuelva a la seccion SOAP y firme la nota.
              </p>
            </div>
          )}
          <Button
            className="w-full"
            variant="success"
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            onClick={onComplete}
            disabled={completing || !disposition || !noteSigned}
          >
            {completing ? 'Cerrando...' : 'Cerrar Encuentro'}
          </Button>
        </div>
      )}
    </Card>
  );
}
