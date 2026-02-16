'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Scan, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReceiveSpecimen } from '@/hooks/useLaboratory';
import { cn } from '@/lib/utils';
import type { LabSpecimenReceiveData } from '@/types/laboratory';

interface SpecimenReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  testName: string;
  specimenType: string;
}

export function SpecimenReceiveModal({
  isOpen,
  onClose,
  orderId,
  testName,
  specimenType,
}: SpecimenReceiveModalProps) {
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<LabSpecimenReceiveData>();
  const receiveMutation = useReceiveSpecimen();

  useEffect(() => {
    if (isOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        setValue('accession_number', barcodeBuffer);
        setBarcodeBuffer('');
      } else if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);
      }
    };

    const resetBuffer = setTimeout(() => setBarcodeBuffer(''), 100);

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(resetBuffer);
    };
  }, [isOpen, barcodeBuffer, setValue]);

  const onSubmit = async (data: LabSpecimenReceiveData) => {
    try {
      // Destructure to remove order_id from data to avoid duplication
      const { order_id, ...dataWithoutOrderId } = data;
      await receiveMutation.mutateAsync({
        order_id: orderId,
        ...dataWithoutOrderId,
        specimen_type: specimenType as any,
        collection_date: new Date().toISOString().split('T')[0],
        collection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      });
      onClose();
    } catch (error) {
      console.error('Failed to receive specimen:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden"
        style={{ background: `rgba(var(--hos-bg-card))` }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">Recibir Muestra</h2>
            <p className="text-sm text-white/50 mt-0.5">{testName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Código de Barras
            </label>
            <div className="relative">
              <input
                {...register('accession_number', {
                  required: 'Código de barras requerido',
                  // Merge refs: react-hook-form's ref + our barcodeInputRef
                  setValueAs: (v) => {
                    // Set the ref after registration
                    return v;
                  }
                })}
                ref={(e) => {
                  // Merge both refs
                  register('accession_number').ref(e);
                  if (e) {
                    (barcodeInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }}
                type="text"
                className={cn(
                  'w-full h-11 px-4 pl-11 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-white/30',
                  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                  errors.accession_number && 'border-red-500'
                )}
                placeholder="Escanear o ingresar manualmente"
                autoComplete="off"
              />
              <Scan className="absolute left-3 top-3 w-5 h-5 text-white/40" />
            </div>
            {errors.accession_number && (
              <p className="text-xs text-red-400 mt-1">{errors.accession_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Tipo de Muestra
            </label>
            <input
              type="text"
              value={specimenType}
              readOnly
              className="w-full h-11 px-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Tipo de Contenedor
            </label>
            <select
              {...register('container_type')}
              className="w-full h-11 px-4 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Seleccionar...</option>
              <option value="red_top">Tubo Tapa Roja (Sin aditivo)</option>
              <option value="purple_top">Tubo Tapa Morada (EDTA)</option>
              <option value="blue_top">Tubo Tapa Azul (Citrato)</option>
              <option value="green_top">Tubo Tapa Verde (Heparina)</option>
              <option value="yellow_top">Tubo Tapa Amarilla (Gel separador)</option>
              <option value="gray_top">Tubo Tapa Gris (Fluoruro)</option>
              <option value="urine_cup">Copa de Orina</option>
              <option value="sterile_container">Contenedor Estéril</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Volumen (mL)
            </label>
            <input
              {...register('volume', { valueAsNumber: true, min: 0.1 })}
              type="number"
              step="0.1"
              className="w-full h-11 px-4 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white placeholder:text-white/30 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Ej: 5.0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Calidad de la Muestra
            </label>
            <select
              {...register('quality', { required: true })}
              className={cn(
                'w-full h-11 px-4 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white',
                'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                errors.quality && 'border-red-500'
              )}
            >
              <option value="acceptable">Aceptable</option>
              <option value="hemolyzed">Hemolizada</option>
              <option value="clotted">Coagulada</option>
              <option value="insufficient">Insuficiente</option>
              <option value="contaminated">Contaminada</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
              disabled={receiveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={receiveMutation.isPending}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Recibir Muestra
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
