'use client';
import { parseIntSafe } from '@/lib/utils/safe-parse';

import { useState } from 'react';
import {
  Activity,
  Calendar,
  Loader2,
  AlertCircle,
  Play,
  X,
  CheckCircle,
} from 'lucide-react';
import { useRadWorklist, useCreateStudy } from '@/hooks/useRadiology';
import { useForm, Controller } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { RadModality, RadModalityType, RadStudyCreateData } from '@/types/radiology';

// ─── Acquisition Form Modal ─────────────────────────────

interface AcquisitionFormProps {
  orderId: string;
  patientName: string;
  studyDescription: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface AcquisitionFormData {
  study_uid: string;
  protocol_used: string;
  series_count: number;
  images_count: number;
  notes: string;
}

function AcquisitionModal({
  orderId,
  patientName,
  studyDescription,
  onClose,
  onSuccess,
}: AcquisitionFormProps) {
  const createStudy = useCreateStudy();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AcquisitionFormData>({
    defaultValues: {
      study_uid: `1.2.840.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
      protocol_used: '',
      series_count: 1,
      images_count: 0,
      notes: '',
    },
  });

  const onSubmit = async (data: AcquisitionFormData) => {
    try {
      const studyData: RadStudyCreateData = {
        order_id: orderId,
        study_uid: data.study_uid,
        protocol_used: data.protocol_used || undefined,
        series_count: data.series_count,
        images_count: data.images_count,
        notes: data.notes || undefined,
      };

      await createStudy.mutateAsync(studyData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating study:', error);
      alert('Error al crear el estudio. Intente nuevamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-2xl p-6 border-white/10 bg-surface-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Iniciar Adquisición</h2>
            <p className="text-sm text-white/50 mt-1">
              {patientName} - {studyDescription}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5 text-white/70" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Study UID (auto-generated, read-only) */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Study UID (Auto-generado)
            </label>
            <Controller
              name="study_uid"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  readOnly
                  className="bg-white/5 border-white/10 text-white/50 font-mono text-sm"
                />
              )}
            />
          </div>

          {/* Protocol Used */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Protocolo Utilizado
            </label>
            <Controller
              name="protocol_used"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Ej: Protocolo estándar de tórax"
                  className="bg-white/5 border-white/10 text-white"
                />
              )}
            />
          </div>

          {/* Series & Images Count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Número de Series *
              </label>
              <Controller
                name="series_count"
                control={control}
                rules={{ required: 'Requerido', min: 1 }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    className="bg-white/5 border-white/10 text-white"
                    onChange={(e) => field.onChange(parseIntSafe(e.target.value, 1, 'Series Count'))}
                  />
                )}
              />
              {errors.series_count && (
                <p className="mt-1 text-sm text-red-400">{errors.series_count.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Número de Imágenes *
              </label>
              <Controller
                name="images_count"
                control={control}
                rules={{ required: 'Requerido', min: 0 }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    className="bg-white/5 border-white/10 text-white"
                    onChange={(e) => field.onChange(parseIntSafe(e.target.value, 0, 'Images Count'))}
                  />
                )}
              />
              {errors.images_count && (
                <p className="mt-1 text-sm text-red-400">{errors.images_count.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Notas (Opcional)
            </label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  placeholder="Observaciones sobre la adquisición..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createStudy.isPending}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {createStudy.isPending ? 'Creando...' : 'Iniciar Adquisición'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Main Worklist Page ─────────────────────────────────

export default function RadiologyWorklistPage() {
  const [selectedModality, setSelectedModality] = useState<RadModalityType | ''>('');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showAcquisition, setShowAcquisition] = useState<{
    orderId: string;
    patientName: string;
    studyDescription: string;
  } | null>(null);

  const { data, isLoading, refetch } = useRadWorklist(
    {
      modality: selectedModality || undefined,
      date: selectedDate,
      page: 1,
      page_size: 50,
    },
    { refetchInterval: 30000 }
  );

  const items = data?.items || [];

  // Group by modality for tabs
  const modalityCounts = items.reduce((acc, item) => {
    acc[item.modality] = (acc[item.modality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const modalities: RadModalityType[] = ['CR', 'CT', 'MR', 'US'];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'text-blue-400 bg-blue-500/20',
      in_progress: 'text-amber-400 bg-amber-500/20',
      completed: 'text-green-400 bg-green-500/20',
    };

    const labels: Record<string, string> = {
      scheduled: 'Programado',
      in_progress: 'En Proceso',
      completed: 'Completado',
    };

    return (
      <Badge className={variants[status]}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'stat') {
      return (
        <Badge className="text-red-400 bg-red-500/20 font-bold animate-pulse">
          STAT
        </Badge>
      );
    }
    if (priority === 'urgent') {
      return <Badge className="text-amber-400 bg-amber-500/20">Urgente</Badge>;
    }
    return null;
  };

  const handleStartAcquisition = (item: typeof items[0]) => {
    setShowAcquisition({
      orderId: item.order_id,
      patientName: item.patient_name,
      studyDescription: item.study_description,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
            <Activity className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Worklist - Técnicos</h1>
            <p className="text-sm text-white/50">
              {items.length} estudios programados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
            <Calendar className="w-4 h-4 text-white/70" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 text-white text-sm p-0 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Modality Tabs */}
      <Card className="p-4 border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02]">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedModality('')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-all',
              selectedModality === ''
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
            )}
          >
            Todas
            {items.length > 0 && (
              <Badge className="ml-2 bg-white/10 text-white/90">
                {items.length}
              </Badge>
            )}
          </button>
          {modalities.map((modality) => {
            const count = modalityCounts[modality] || 0;
            const colors: Record<RadModalityType, string> = {
              CR: 'border-blue-500/50 bg-blue-500/20 text-blue-400',
              CT: 'border-purple-500/50 bg-purple-500/20 text-purple-400',
              MR: 'border-green-500/50 bg-green-500/20 text-green-400',
              US: 'border-cyan-500/50 bg-cyan-500/20 text-cyan-400',
              NM: 'border-amber-500/50 bg-amber-500/20 text-amber-400',
              PT: 'border-pink-500/50 bg-pink-500/20 text-pink-400',
              XA: 'border-indigo-500/50 bg-indigo-500/20 text-indigo-400',
              MG: 'border-rose-500/50 bg-rose-500/20 text-rose-400',
              DX: 'border-gray-500/50 bg-gray-500/20 text-gray-400',
              OT: 'border-gray-500/50 bg-gray-500/20 text-gray-400',
            };

            return (
              <button
                key={modality}
                onClick={() => setSelectedModality(modality)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-all border',
                  selectedModality === modality
                    ? colors[modality]
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                )}
              >
                {modality}
                {count > 0 && (
                  <Badge className="ml-2 bg-white/10 text-white/90">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Worklist Table */}
      <Card className="border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto mb-3 text-white/20" />
            <p className="text-white/50">No hay estudios programados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Hora
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Paciente
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    MRN
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Estudio
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Modalidad
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Médico
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Prioridad
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items
                  .sort((a, b) => {
                    // Sort by priority (STAT first) then by scheduled time
                    const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
                    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
                    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                  })
                  .map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-white">
                          {item.scheduled_time
                            ? new Date(`2000-01-01T${item.scheduled_time}`).toLocaleTimeString(
                                'es-ES',
                                { hour: '2-digit', minute: '2-digit' }
                              )
                            : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-white">
                          {item.patient_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white/70 font-mono">
                          {item.patient_mrn}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white/90">
                          {item.study_description}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            {
                              CR: 'text-blue-400 bg-blue-500/20',
                              CT: 'text-purple-400 bg-purple-500/20',
                              MR: 'text-green-400 bg-green-500/20',
                              US: 'text-cyan-400 bg-cyan-500/20',
                              DX: 'text-indigo-400 bg-indigo-500/20',
                              MG: 'text-pink-400 bg-pink-500/20',
                              NM: 'text-yellow-400 bg-yellow-500/20',
                              OT: 'text-gray-400 bg-gray-500/20',
                              PT: 'text-orange-400 bg-orange-500/20',
                              XA: 'text-red-400 bg-red-500/20',
                            }[item.modality] || 'text-gray-400 bg-gray-500/20'
                          }
                        >
                          {item.modality}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white/70">
                          {item.ordering_physician_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getPriorityBadge(item.priority)}</td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-right">
                        {item.status === 'scheduled' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartAcquisition(item)}
                            className="bg-primary-600 hover:bg-primary-700"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {item.status === 'in_progress' && (
                          <Badge className="text-amber-400 bg-amber-500/20">
                            En Progreso
                          </Badge>
                        )}
                        {item.status === 'completed' && (
                          <Badge className="text-green-400 bg-green-500/20">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Completado
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Acquisition Modal */}
      {showAcquisition && (
        <AcquisitionModal
          orderId={showAcquisition.orderId}
          patientName={showAcquisition.patientName}
          studyDescription={showAcquisition.studyDescription}
          onClose={() => setShowAcquisition(null)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
