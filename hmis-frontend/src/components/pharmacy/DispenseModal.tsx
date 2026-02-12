'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useDispensePrescription, useProductLots } from '@/hooks/usePharmacyData';
import type { Prescription, Lot } from '@/app/(app)/pharmacy/types';

interface DispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription | null;
}

export function DispenseModal({ isOpen, onClose, prescription }: DispenseModalProps) {
  const [selectedLotId, setSelectedLotId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const dispenseMutation = useDispensePrescription();

  // Fetch available lots for this product (FEFO sorted by backend)
  const { data: lots, isLoading: loadingLots } = useProductLots(
    prescription?.product_id || '',
    !!prescription?.product_id
  );

  const availableLots = (lots || []).filter((lot: Lot) => lot.quantity_available > 0);
  const selectedLot = availableLots.find((lot: Lot) => lot.id === selectedLotId);

  const handleSubmit = async () => {
    if (!prescription) return;

    if (!selectedLotId) {
      setFormError('Debe seleccionar un lote');
      return;
    }
    if (quantity <= 0) {
      setFormError('La cantidad debe ser mayor a 0');
      return;
    }
    if (selectedLot && quantity > selectedLot.quantity_available) {
      setFormError(`Stock insuficiente. Disponible: ${selectedLot.quantity_available}`);
      return;
    }
    if (quantity > prescription.quantity) {
      setFormError(`No puede dispensar más de lo recetado (${prescription.quantity})`);
      return;
    }

    try {
      await dispenseMutation.mutateAsync({
        prescriptionId: prescription.id,
        lotId: selectedLotId,
        patientId: prescription.patient_id,
        quantity,
        notes: notes || undefined,
      });
      toast.success('Medicamento dispensado exitosamente');
      handleClose();
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Error al dispensar medicamento';
      toast.error(message);
      setFormError(message);
    }
  };

  const handleClose = () => {
    setSelectedLotId('');
    setQuantity(0);
    setNotes('');
    setFormError(null);
    onClose();
  };

  if (!prescription) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dispensar Medicamento"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={dispenseMutation.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={dispenseMutation.isPending}>
            {dispenseMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Dispensando...
              </>
            ) : (
              'Confirmar Dispensación'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        )}

        {/* Prescription Details (Read-Only) */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Receta</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-neutral-500">Paciente:</span>{' '}
              <span className="font-medium">{prescription.patient_name || '-'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Medicamento:</span>{' '}
              <span className="font-medium">{prescription.product_name || '-'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Dosis:</span>{' '}
              <span className="font-medium">{prescription.dosage}</span>
            </div>
            <div>
              <span className="text-neutral-500">Frecuencia:</span>{' '}
              <span className="font-medium">{prescription.frequency}</span>
            </div>
            <div>
              <span className="text-neutral-500">Cantidad Recetada:</span>{' '}
              <span className="font-semibold text-primary-700">{prescription.quantity}</span>
            </div>
            <div>
              <span className="text-neutral-500">Estado:</span>{' '}
              <span className="font-medium">{prescription.status}</span>
            </div>
          </div>
        </div>

        {/* Lot Selection (FEFO) */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Seleccionar Lote *</h3>
          {loadingLots ? (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400" />
              <p className="text-xs text-neutral-500 mt-1">Cargando lotes...</p>
            </div>
          ) : availableLots.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  No hay lotes disponibles para este producto. Verifique el inventario.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {availableLots.map((lot: Lot) => (
                <label
                  key={lot.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedLotId === lot.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="lot"
                      value={lot.id}
                      checked={selectedLotId === lot.id}
                      onChange={() => {
                        setSelectedLotId(lot.id);
                        setFormError(null);
                      }}
                      className="text-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Lote: {lot.lot_number}</p>
                      <p className="text-xs text-neutral-500">
                        Vence: {new Date(lot.expiration_date).toLocaleDateString('es-DO')}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-neutral-700">
                    Disp: {lot.quantity_available}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <Input
            label="Cantidad a Dispensar *"
            type="number"
            value={quantity.toString()}
            onChange={(e) => {
              setQuantity(parseInt(e.target.value) || 0);
              setFormError(null);
            }}
            placeholder="Ingrese cantidad"
          />
          {selectedLot && (
            <p className="text-xs text-neutral-400 mt-1">
              Máximo disponible en lote: {selectedLot.quantity_available} | Recetado: {prescription.quantity}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales sobre la dispensación..."
            rows={2}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
