'use client';
import { parseIntSafe, parseFloatSafe } from '@/lib/utils/safe-parse';

import { useForm, useFieldArray } from 'react-hook-form';
import { Save, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEnterResults } from '@/hooks/useLaboratory';
import { cn } from '@/lib/utils';
import type { LabTest } from '@/types/laboratory';
import { captureException } from '@/lib/monitoring';

interface ResultComponent {
  component_code: string;
  component_name: string;
  value: string;
  unit: string;
  reference_range?: string;
  abnormal_flag?: 'N' | 'H' | 'L' | 'A' | 'AA';
  is_critical: boolean;
}

interface ResultEntryFormData {
  order_test_id: string;
  results: ResultComponent[];
  analyzer?: string;
  method?: string;
  notes?: string;
  result_status: 'preliminary' | 'final';
}

interface ResultEntryFormProps {
  orderTestId: string;
  test: LabTest;
  onSuccess?: () => void;
}

export function ResultEntryForm({ orderTestId, test, onSuccess }: ResultEntryFormProps) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ResultEntryFormData>({
    defaultValues: {
      order_test_id: orderTestId,
      results: test.normal_range ? [{
        component_code: test.code,
        component_name: test.name,
        value: '',
        unit: test.units || '',
        reference_range: test.normal_range,
        abnormal_flag: 'N',
        is_critical: false,
      }] : [],
      result_status: 'preliminary',
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'results',
  });

  const enterMutation = useEnterResults();

  const calculateAbnormalFlag = (value: string, referenceRange?: string): 'N' | 'H' | 'L' | 'A' => {
    if (!referenceRange || !value) return 'N';

    const numValue = parseFloatSafe(value, 0, 'Result Value');
    if (numValue === 0) return 'N'; // Invalid parse resulted in fallback

    const rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (!rangeMatch) return 'N';

    const [, min, max] = rangeMatch;
    const minValue = parseFloatSafe(min, 0, 'Reference Min');
    const maxValue = parseFloatSafe(max, 100, 'Reference Max');

    if (numValue < minValue) return 'L';
    if (numValue > maxValue) return 'H';
    return 'N';
  };

  const onSubmit = async (data: ResultEntryFormData) => {
    try {
      await enterMutation.mutateAsync({
        order_test_id: data.order_test_id,
        result_value: data.results[0]?.value,
        result_numeric: parseFloatSafe(data.results[0]?.value, 0, 'Result Numeric'),
        is_abnormal: data.results[0]?.abnormal_flag !== 'N',
        is_critical: data.results[0]?.is_critical,
        notes: data.notes,
      });
      onSuccess?.();
    } catch (error) {
      captureException(error, {
        context: 'enter_lab_results',
        orderTestId: data.order_test_id,
        testName: test.name,
        resultStatus: data.result_status,
      });
      console.error('Failed to enter results:', error);
    }
  };

  const handleValueChange = (index: number, value: string) => {
    setValue(`results.${index}.value`, value);
    const referenceRange = watch(`results.${index}.reference_range`);
    const autoFlag = calculateAbnormalFlag(value, referenceRange);
    setValue(`results.${index}.abnormal_flag`, autoFlag);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        {fields.map((field, index) => {
          const value = watch(`results.${index}.value`);
          const abnormalFlag = watch(`results.${index}.abnormal_flag`);
          const isCritical = watch(`results.${index}.is_critical`);
          const refRange = watch(`results.${index}.reference_range`);

          return (
            <div
              key={field.id}
              className={cn(
                'p-4 rounded-lg border',
                isCritical ? 'border-red-500 bg-red-500/5' : 'border-white/[0.06] bg-white/[0.02]'
              )}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    {field.component_name}
                  </label>
                  <p className="text-xs text-white/40">
                    Rango de referencia: {refRange || 'No especificado'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      Valor
                    </label>
                    <input
                      {...register(`results.${index}.value`, { required: 'Valor requerido' })}
                      type="text"
                      onChange={(e) => handleValueChange(index, e.target.value)}
                      className={cn(
                        'w-full h-10 px-3 rounded-lg border bg-white/[0.03] text-white placeholder:text-white/30',
                        'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                        errors.results?.[index]?.value ? 'border-red-500' : 'border-white/[0.06]'
                      )}
                      placeholder="Ingrese valor..."
                      autoFocus={index === 0}
                      tabIndex={index + 1}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      Unidad
                    </label>
                    <input
                      {...register(`results.${index}.unit`)}
                      type="text"
                      readOnly
                      className="w-full h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      Indicador Anormal
                    </label>
                    <select
                      {...register(`results.${index}.abnormal_flag`)}
                      className={cn(
                        'w-full h-10 px-3 rounded-lg border bg-white/[0.03] text-white',
                        'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                        abnormalFlag === 'H' || abnormalFlag === 'L' ? 'border-amber-500' : 'border-white/[0.06]'
                      )}
                    >
                      <option value="N">Normal</option>
                      <option value="H">Alto (H)</option>
                      <option value="L">Bajo (L)</option>
                      <option value="A">Anormal (A)</option>
                      <option value="AA">Muy Anormal (AA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      Valor Crítico
                    </label>
                    <label className="flex items-center h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.03]">
                      <input
                        {...register(`results.${index}.is_critical`)}
                        type="checkbox"
                        className="w-4 h-4 rounded border-white/[0.06] bg-white/[0.03] text-red-500 focus:ring-red-500 focus:ring-offset-0"
                      />
                      <span className="ml-2 text-sm text-white/70">Marcar como crítico</span>
                    </label>
                  </div>
                </div>

                {isCritical && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-xs font-medium text-red-400">
                      ⚠️ Valor crítico - Requiere notificación inmediata al médico
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Analizador
          </label>
          <select
            {...register('analyzer')}
            className="w-full h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Manual</option>
            <option value="cobas_e411">Cobas e411</option>
            <option value="sysmex_xs1000i">Sysmex XS-1000i</option>
            <option value="mindray_bc5390">Mindray BC-5390</option>
            <option value="architect_ci4100">Architect ci4100</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Método
          </label>
          <input
            {...register('method')}
            type="text"
            className="w-full h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-white/30 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Ej: Espectrofotometría"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Notas
        </label>
        <textarea
          {...register('notes', {
            maxLength: {
              value: 500,
              message: 'Máximo 500 caracteres'
            }
          })}
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-white/30 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
          placeholder="Observaciones adicionales..."
        />
        <p className="text-xs text-white/40 mt-1">
          {(watch('notes') || '').length}/500 caracteres
        </p>
      </div>

      <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
        <Button
          type="submit"
          variant="ghost"
          className="flex-1"
          isLoading={enterMutation.isPending}
          leftIcon={<Save className="w-4 h-4" />}
          onClick={() => setValue('result_status', 'preliminary')}
        >
          Guardar como Preliminar
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          isLoading={enterMutation.isPending}
          leftIcon={<FileCheck className="w-4 h-4" />}
          onClick={() => setValue('result_status', 'final')}
        >
          Guardar como Final
        </Button>
      </div>
    </form>
  );
}
