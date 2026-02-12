'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invoice } from '@/hooks/useInvoices';

interface CreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

interface CreditNoteFormData {
  reason: string;
  full_reversal: boolean;
}

export function CreditNoteModal({ isOpen, onClose, invoice }: CreditNoteModalProps) {
  const [formData, setFormData] = useState<CreditNoteFormData>({
    reason: '',
    full_reversal: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const createCreditNote = useMutation({
    mutationFn: async (data: { original_invoice_id: string; reason: string; full_reversal: boolean }) => {
      return api.post('/billing/credit-notes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const handleSubmit = async () => {
    if (!invoice) return;

    if (!formData.reason || formData.reason.length < 10) {
      setFormError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      await createCreditNote.mutateAsync({
        original_invoice_id: invoice.id,
        reason: formData.reason,
        full_reversal: formData.full_reversal,
      });
      toast.success('Nota de crédito creada');
      setFormData({ reason: '', full_reversal: true });
      setFormError(null);
      onClose();
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Error al crear nota de crédito';
      setFormError(message);
    }
  };

  const handleClose = () => {
    setFormData({ reason: '', full_reversal: true });
    setFormError(null);
    onClose();
  };

  if (!invoice) return null;

  const formatRD = (amount: number) =>
    `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear Nota de Crédito"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={createCreditNote.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createCreditNote.isPending}>
            {createCreditNote.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Nota de Crédito'
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

        {/* Invoice Reference */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Factura Original</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-neutral-500">Número:</span>{' '}
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div>
              <span className="text-neutral-500">NCF:</span>{' '}
              <span className="font-medium">{invoice.fiscal_number || '-'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Cliente:</span>{' '}
              <span className="font-medium">{invoice.customer_name || '-'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Monto:</span>{' '}
              <span className="font-semibold text-primary-700">{formatRD(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Credit Note Type */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Tipo de Nota de Crédito</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={formData.full_reversal}
                onChange={() => setFormData((prev) => ({ ...prev, full_reversal: true }))}
                className="text-primary-600"
              />
              <span className="text-sm">Reversión total ({formatRD(invoice.grand_total)})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!formData.full_reversal}
                onChange={() => setFormData((prev) => ({ ...prev, full_reversal: false }))}
                className="text-primary-600"
              />
              <span className="text-sm">Parcial</span>
            </label>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Motivo de la Nota de Crédito *
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, reason: e.target.value }));
              setFormError(null);
            }}
            placeholder="Explique el motivo de la nota de crédito (mínimo 10 caracteres)..."
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">{formData.reason.length}/500 caracteres</p>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Nota:</strong> Una vez creada, la nota de crédito generará un NCF tipo 04
            y afectará los reportes fiscales (607/608).
          </p>
        </div>
      </div>
    </Modal>
  );
}
