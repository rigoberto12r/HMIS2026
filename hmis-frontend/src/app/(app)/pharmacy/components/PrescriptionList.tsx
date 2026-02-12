'use client';

import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { usePrescriptions } from '@/hooks/usePharmacyData';
import type { Prescription } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface PrescriptionListProps {
  onDispense: (rx: Prescription) => void;
}

export function PrescriptionList({ onDispense }: PrescriptionListProps) {
  const { data: prescriptionsData, isLoading } = usePrescriptions({
    page: 1,
    page_size: 20,
    status: 'pending',
  });

  const handleDownload = (rx: Prescription) => {
    const token = localStorage.getItem('hmis_access_token');
    const tenantId = localStorage.getItem('hmis_tenant_id') || 'demo';

    fetch(`${API_BASE_URL}/pharmacy/prescriptions/${rx.id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error descargando PDF');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receta_${rx.id.substring(0, 8)}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Error downloading prescription PDF:', err);
        toast.error('No se pudo descargar el PDF de la receta');
      });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Cargando recetas...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        Recetas Pendientes de Dispensación
      </h2>
      <div className="space-y-3">
        {prescriptionsData?.items.length === 0 ? (
          <p className="text-center text-neutral-500 py-8">
            No hay recetas pendientes de dispensación
          </p>
        ) : (
          prescriptionsData?.items.map((rx) => (
            <div
              key={rx.id}
              className="p-4 border border-neutral-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-neutral-900">{rx.patient_name}</h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    <span className="font-medium">{rx.product_name}</span>
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                    <span>Dosis: {rx.dosage}</span>
                    <span>Frecuencia: {rx.frequency}</span>
                    <span>Cantidad: {rx.quantity}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(rx)}
                    className="p-2 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDispense(rx)}
                    className="px-3 py-1 bg-primary-500 text-white rounded text-sm hover:bg-primary-600"
                  >
                    Dispensar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
