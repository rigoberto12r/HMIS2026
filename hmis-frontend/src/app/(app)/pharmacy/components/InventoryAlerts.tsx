'use client';

import { AlertTriangle } from 'lucide-react';
import { useInventoryAlerts } from '@/hooks/usePharmacyData';

export function InventoryAlerts() {
  const { data: alerts, isLoading } = useInventoryAlerts();

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Cargando alertas...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">Alertas de Stock Bajo</h2>
      {alerts && alerts.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <p className="text-neutral-500">No hay alertas de inventario</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts?.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-l-4 rounded-lg ${
                alert.alert_type === 'low_stock'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-red-400 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900">{alert.product_name}</h3>
                  <p className="text-sm text-neutral-600 mt-1">{alert.detail}</p>
                  <div className="mt-2 text-xs text-neutral-500">
                    Stock actual: {alert.current_stock} {alert.unit} | Punto de reorden:{' '}
                    {alert.reorder_point} {alert.unit}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    alert.alert_type === 'low_stock'
                      ? 'bg-orange-200 text-orange-800'
                      : 'bg-red-200 text-red-800'
                  }`}
                >
                  {alert.alert_type === 'low_stock' ? 'Stock Bajo' : 'Crítico'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
