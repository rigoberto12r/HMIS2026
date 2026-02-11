/**
 * Pharmacy Page - Refactored
 * Reduced from 1,095 lines using React Query and modular components
 */

'use client';

import { useState } from 'react';
import { Pill, Package, AlertTriangle, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PharmacyStats } from './components/PharmacyStats';
import {
  usePrescriptions,
  useProducts,
  useInventoryAlerts,
  useExpiringLots,
} from '@/hooks/usePharmacyData';

type TabKey = 'dispensacion' | 'inventario' | 'productos' | 'lotes';

const tabs = [
  { key: 'dispensacion' as TabKey, label: 'Dispensación', icon: Pill },
  { key: 'productos' as TabKey, label: 'Productos', icon: Package },
  { key: 'inventario' as TabKey, label: 'Alertas de Inventario', icon: AlertTriangle },
  { key: 'lotes' as TabKey, label: 'Lotes por Vencer', icon: Calendar },
];

export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dispensacion');

  // Fetch data based on active tab
  const { data: prescriptionsData, isLoading: loadingPrescriptions } = usePrescriptions({
    page: 1,
    page_size: 20,
    status: 'pending',
  });

  const { data: productsData, isLoading: loadingProducts } = useProducts({
    page: 1,
    page_size: 20,
  });

  const { data: alerts, isLoading: loadingAlerts } = useInventoryAlerts();
  const { data: expiringLots, isLoading: loadingLots } = useExpiringLots(90);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Farmacia</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Gestión de recetas, inventario y dispensación
        </p>
      </div>

      {/* KPI Stats */}
      <PharmacyStats />

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Card className="p-6">
        {activeTab === 'dispensacion' && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Recetas Pendientes de Dispensación
            </h2>
            {loadingPrescriptions ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Cargando recetas...</p>
              </div>
            ) : (
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
                        <button className="px-3 py-1 bg-primary-500 text-white rounded text-sm hover:bg-primary-600">
                          Dispensar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'productos' && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Catálogo de Productos
            </h2>
            {loadingProducts ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Cargando productos...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productsData?.items.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 border border-neutral-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-neutral-900">{product.name}</h3>
                      {product.requires_prescription && (
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                          Rx
                        </span>
                      )}
                    </div>
                    {product.generic_name && (
                      <p className="text-sm text-neutral-500">{product.generic_name}</p>
                    )}
                    <div className="mt-3 flex gap-2 text-xs text-neutral-500">
                      <span className="px-2 py-1 bg-neutral-100 rounded">
                        {product.code}
                      </span>
                      <span className="px-2 py-1 bg-neutral-100 rounded">
                        {product.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventario' && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Alertas de Stock Bajo
            </h2>
            {loadingAlerts ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Cargando alertas...</p>
              </div>
            ) : alerts && alerts.length === 0 ? (
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
                        <h3 className="font-semibold text-neutral-900">
                          {alert.product_name}
                        </h3>
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
        )}

        {activeTab === 'lotes' && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Lotes Próximos a Vencer (90 días)
            </h2>
            {loadingLots ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Cargando lotes...</p>
              </div>
            ) : expiringLots && expiringLots.length === 0 ? (
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
                        <h3 className="font-semibold text-neutral-900">
                          {lot.product_name}
                        </h3>
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
        )}
      </Card>
    </div>
  );
}
