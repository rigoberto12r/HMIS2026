'use client';

import { Calendar } from 'lucide-react';
import { useExpiringLots } from '@/hooks/usePharmacyData';

export function ExpiringLots() {
  const { data: expiringLots, isLoading } = useExpiringLots(90);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Cargando lotes...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        Lotes Próximos a Vencer (90 días)
      </h2>
      {expiringLots && expiringLots.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="text-neutral-500">No hay lotes próximos a vencer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expiringLots?.map((lot) => (
            <div
              key={lot.id}
              className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900">{lot.product_name}</h3>
                  <div className="mt-2 flex gap-4 text-sm text-neutral-600">
                    <span>Lote: {lot.lot_number}</span>
                    <span>Vence: {new Date(lot.expiration_date).toLocaleDateString('es-DO')}</span>
                    <span>Cantidad: {lot.quantity_available}</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                  Por Vencer
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
