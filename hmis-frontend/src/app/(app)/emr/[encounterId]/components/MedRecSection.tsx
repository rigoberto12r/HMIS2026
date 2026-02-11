/**
 * MedRecSection Component
 * Shows medication reconciliation status and provides navigation to the med-rec wizard.
 */

'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMedRecByEncounter, useStartMedRec } from '@/hooks/useMedRec';

interface MedRecSectionProps {
  encounterId: string;
  patientId: string;
  isReadOnly: boolean;
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

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'primary' | 'default' }> = {
  completed: { label: 'Completada', variant: 'success' },
  in_progress: { label: 'En Progreso', variant: 'warning' },
  pending: { label: 'Pendiente', variant: 'primary' },
};

export function MedRecSection({ encounterId, patientId, isReadOnly }: MedRecSectionProps) {
  const router = useRouter();
  const { data: medRec, isLoading, error } = useMedRecByEncounter(encounterId);
  const startMutation = useStartMedRec();

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync({
        encounter_id: encounterId,
        patient_id: patientId,
        reconciliation_type: 'admission',
      });
      router.push(`/emr/${encounterId}/med-rec`);
    } catch {
      // Error handled by React Query
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  // No reconciliation exists yet — show prompt to start one
  if (error || !medRec) {
    return (
      <Card>
        <CardHeader
          title="Reconciliacion de Medicamentos"
          subtitle="Compare medicamentos del hogar con los prescritos durante este encuentro"
        />
        <div className="text-center py-8">
          <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
            No se ha iniciado una reconciliacion de medicamentos para este encuentro.
            La reconciliacion ayuda a prevenir errores de medicacion al comparar la lista
            de medicamentos del paciente con las nuevas prescripciones.
          </p>
          {!isReadOnly && (
            <Button
              onClick={handleStart}
              isLoading={startMutation.isPending}
              leftIcon={<ClipboardList className="w-4 h-4" />}
            >
              Iniciar Reconciliacion
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Reconciliation exists — show summary
  const status = statusConfig[medRec.status] || statusConfig['pending'];
  const isComplete = medRec.status === 'completed';
  const continueMeds = medRec.continue_medications?.length ?? 0;
  const discontinueMeds = medRec.discontinue_medications?.length ?? 0;
  const newMeds = medRec.new_medications?.length ?? 0;

  return (
    <Card>
      <CardHeader
        title="Reconciliacion de Medicamentos"
        action={<Badge variant={status.variant} dot>{status.label}</Badge>}
      />

      {isComplete ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Reconciliacion completada</p>
              {medRec.reconciled_at && (
                <p className="text-xs text-green-500">{formatDate(medRec.reconciled_at)}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-neutral-50 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{continueMeds}</p>
              <p className="text-xs text-neutral-500">Continuados</p>
            </div>
            <div className="text-center p-3 bg-neutral-50 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{discontinueMeds}</p>
              <p className="text-xs text-neutral-500">Descontinuados</p>
            </div>
            <div className="text-center p-3 bg-neutral-50 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{newMeds}</p>
              <p className="text-xs text-neutral-500">Nuevos</p>
            </div>
          </div>
          {medRec.notes && (
            <div className="p-3 bg-neutral-50 rounded-lg">
              <p className="text-xs text-neutral-400 mb-1">Notas</p>
              <p className="text-sm text-neutral-700">{medRec.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
          <Clock className="w-8 h-8 text-yellow-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900">Reconciliacion en progreso</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Iniciada el {formatDate(medRec.created_at)}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push(`/emr/${encounterId}/med-rec`)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continuar
          </Button>
        </div>
      )}
    </Card>
  );
}
